import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import csrf from "csurf";
import NodeCache from "node-cache";
import crypto from "crypto";
import admin from "firebase-admin";
import { google } from "googleapis";
import { validateVitals, selectModel } from "./src/lib/medicalLogic";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/auth/google/callback`
);

// Initialize Firebase Admin
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
  }
}

const db = new Database("diagnosis_history.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_uid TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    symptoms TEXT,
    vitals TEXT,
    demographics TEXT,
    summary TEXT,
    conditions TEXT,
    urgency TEXT,
    consent_timestamp TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_uid TEXT,
    model_used TEXT,
    input_hash TEXT,
    response_hash TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_tokens (
    user_uid TEXT PRIMARY KEY,
    provider TEXT,
    access_token TEXT,
    refresh_token TEXT,
    expiry_date INTEGER
  )
`);

// Gemini Initialization (Server-side only)
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Cache Initialization (6 hours TTL)
const diagnosisCache = new NodeCache({ stdTTL: 6 * 60 * 60, checkperiod: 600 });
let cacheHits = 0;
let cacheMisses = 0;

function getCacheKey(symptoms: string[], vitals: any, demographics: any): string {
  const data = JSON.stringify({ symptoms: symptoms.sort(), vitals, demographics });
  return crypto.createHash("sha256").update(data).digest("hex");
}

export const app = express();
const PORT = 3000;

// Trust proxy for rate limiting behind load balancers/proxies
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(cookieParser());

// Authentication Middleware
const authenticateUser = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

const optionalAuthenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const idToken = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken;
    } catch (error) {
      // Ignore invalid tokens for optional auth
    }
  }
  next();
};

const isAdmin = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  
  const adminEmails = (process.env.ADMIN_EMAILS || "shreya.cs23068@sstcollege.edu.in").split(",");
  if (adminEmails.includes(req.user.email)) {
    next();
  } else {
    res.status(403).json({ error: "Forbidden: Admin access required" });
  }
};

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  validate: { trustProxy: false }, // We already set app.set('trust proxy', 1)
});
app.use("/api/", limiter);

// CSRF Protection
const csrfProtection = csrf({ cookie: true });

// Provide CSRF token to frontend
app.get("/api/csrf-token", csrfProtection, (req, res) => {
  res.json({ csrfToken: (req as any).csrfToken() });
});

// API Routes
app.post("/api/diagnose", optionalAuthenticate, csrfProtection, async (req: any, res) => {
  const { symptoms, additionalInfo, vitals, demographics, wearableData } = req.body;
  const user_uid = req.user?.uid || "anonymous";

  // 1. Validation: Conflicting/Impossible Vitals
  const vitalsValidation = validateVitals(vitals);
  if (!vitalsValidation.valid) {
    return res.status(422).json({ 
      code: "CONFLICTING_VITALS",
      error: vitalsValidation.error,
      suggestion: vitalsValidation.suggestion
    });
  }

  if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
    return res.status(400).json({ 
      code: "INCONCLUSIVE_SYMPTOMS",
      error: "No symptoms were selected.",
      suggestion: "Please select at least one symptom from the list or body map."
    });
  }

  // Check Cache
  const cacheKey = getCacheKey(symptoms, vitals, demographics);
  const cachedResult = diagnosisCache.get(cacheKey);

  if (cachedResult && !additionalInfo) {
    cacheHits++;
    console.log(`[Cache Hit] Rate: ${((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(2)}%`);
    return res.json(cachedResult);
  }

  cacheMisses++;
  console.log(`[Cache Miss] Rate: ${((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(2)}%`);

  try {
    const modelName = selectModel(symptoms, additionalInfo, demographics);
    
    const vitalsString = vitals ? `
    Vitals:
    - Temperature: ${vitals.temperature || "Not provided"}
    - Blood Pressure: ${vitals.bloodPressure || "Not provided"}
    - Heart Rate: ${vitals.heartRate || "Not provided"}
    - SpO2: ${vitals.spO2 || "Not provided"}
    ` : "";

    const demographicsString = demographics ? `
    Patient Demographics:
    - Age: ${demographics.age || "Not provided"}
    - Gender: ${demographics.gender || "Not provided"}
    - Pre-existing Conditions: ${demographics.preExistingConditions || "None reported"}
    ` : "";

    const wearableString = wearableData ? `
    Wearable Data (Last 7 Days Avg):
    - Steps: ${Math.round(wearableData.avgSteps)}
    - Heart Rate: ${Math.round(wearableData.avgHeartRate)} bpm
    - Sleep: ${wearableData.sleepHours.toFixed(1)} hours/night
    ` : "";

    const prompt = `Analyze the following symptoms, vitals, patient demographics, and wearable data to provide a preliminary diagnostic assessment. 
    Symptoms: ${symptoms.join(", ")}
    ${demographicsString}
    ${vitalsString}
    ${wearableString}
    Additional Context: ${additionalInfo || "None provided"}
    
    CRITICAL SAFETY RULES:
    1. For 'Routine' urgency cases, you may suggest common Over-The-Counter (OTC) medications (e.g., Paracetamol, Ibuprofen, Antacids).
    2. NEVER suggest prescription-only medications (e.g., Antibiotics, Steroids, Opioids).
    3. NEVER provide dosage instructions (e.g., "take 500mg every 4 hours").
    4. If symptoms are too vague or contradictory, set the "inconclusive" flag to true.
    
    Provide the response in a structured JSON format with the following keys:
    - summary: A brief overview of the assessment.
    - inconclusive: boolean (true if symptoms are too vague).
    - possibleConditions: An array of objects, each with:
      - condition: Name of the condition.
      - probability: A percentage string.
      - urgency: One of 'Routine', 'Urgent', 'Emergency'.
      - probableSpecialty: The type of medical specialist the patient should see (e.g., 'Cardiologist', 'Dermatologist', 'General Practitioner').
      - commonSymptoms: Array of strings.
      - nextSteps: Array of strings.
      - otcSuggestions: Array of strings (ONLY for 'Routine' cases).
      - pharmacyLinks: Array of objects with { name, url } (provide links to major pharmacies like CVS, Walgreens, or Amazon Pharmacy for the suggested OTC meds).
    - disclaimer: A medical disclaimer.`;

    // 2. API Timeout Handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    const result = await genAI.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    clearTimeout(timeoutId);

    const diagnosis = JSON.parse(result.text || "{}");

    // Audit Logging
    const inputData = JSON.stringify({ symptoms, additionalInfo, vitals, demographics });
    const inputHash = crypto.createHash("sha256").update(inputData).digest("hex");
    const responseHash = crypto.createHash("sha256").update(result.text || "").digest("hex");

    db.prepare(`
      INSERT INTO audit_logs (user_uid, model_used, input_hash, response_hash)
      VALUES (?, ?, ?, ?)
    `).run(user_uid, modelName, inputHash, responseHash);

    // 3. Inconclusive Symptoms Check
    if (diagnosis.inconclusive) {
      return res.status(422).json({
        code: "INCONCLUSIVE_SYMPTOMS",
        error: "The symptoms provided are too vague for a reliable assessment.",
        suggestion: "Try adding more specific symptoms or using the 'Additional Details' field to describe your condition in more detail."
      });
    }
    
    // Store in Cache if no additional info
    if (!additionalInfo) {
      diagnosisCache.set(cacheKey, diagnosis);
    }

    res.json(diagnosis);
  } catch (error: any) {
    // Log technical errors server-side only
    console.error("[Technical Error] Gemini API:", error.message || error);
    
    if (error.name === 'AbortError') {
      return res.status(504).json({
        code: "API_TIMEOUT",
        error: "The analysis is taking longer than expected.",
        suggestion: "Our AI is currently busy. Please try again in a few moments."
      });
    }

    res.status(500).json({ 
      code: "SERVER_ERROR",
      error: "An unexpected error occurred during analysis.",
      suggestion: "Please try again. If the problem persists, check your internet connection."
    });
  }
});

app.post("/api/history", authenticateUser, csrfProtection, (req: any, res) => {
  const { symptoms, vitals, demographics, summary, conditions, urgency, consentTimestamp } = req.body;
  const user_uid = req.user.uid;
  
  try {
    const stmt = db.prepare(`
      INSERT INTO history (user_uid, symptoms, vitals, demographics, summary, conditions, urgency, consent_timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      user_uid,
      JSON.stringify(symptoms),
      JSON.stringify(vitals),
      JSON.stringify(demographics),
      summary,
      JSON.stringify(conditions),
      urgency,
      consentTimestamp
    );
    
    res.json({ id: result.lastInsertRowid });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Failed to save history" });
  }
});

app.get("/api/history", authenticateUser, (req: any, res) => {
  const user_uid = req.user.uid;
  try {
    const rows = db.prepare("SELECT * FROM history WHERE user_uid = ? ORDER BY timestamp DESC").all(user_uid);
    const history = rows.map(row => ({
      ...row,
      symptoms: JSON.parse(row.symptoms as string),
      vitals: JSON.parse(row.vitals as string),
      demographics: JSON.parse(row.demographics as string),
      conditions: JSON.parse(row.conditions as string)
    }));
    res.json(history);
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.delete("/api/history/:id", authenticateUser, csrfProtection, (req: any, res) => {
  const user_uid = req.user.uid;
  try {
    const result = db.prepare("DELETE FROM history WHERE id = ? AND user_uid = ?").run(req.params.id, user_uid);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Not found or unauthorized" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

// Google Fit OAuth Routes
app.get("/api/auth/google/url", authenticateUser, (req: any, res) => {
  const scopes = [
    "https://www.googleapis.com/auth/fitness.activity.read",
    "https://www.googleapis.com/auth/fitness.body.read",
    "https://www.googleapis.com/auth/fitness.heart_rate.read",
    "https://www.googleapis.com/auth/fitness.sleep.read",
    "openid",
    "email",
    "profile"
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
    state: req.user.uid // Pass user UID in state
  });

  res.json({ url });
});

app.get("/auth/google/callback", async (req, res) => {
  const { code, state } = req.query;
  const user_uid = state as string;

  try {
    const { tokens } = await oauth2Client.getToken(code as string);
    
    // Store tokens in database
    db.prepare(`
      INSERT OR REPLACE INTO user_tokens (user_uid, provider, access_token, refresh_token, expiry_date)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      user_uid,
      "google",
      tokens.access_token,
      tokens.refresh_token,
      tokens.expiry_date
    );

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'WEARABLE_SYNC_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Sync successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Google OAuth error:", error);
    res.status(500).send("Authentication failed");
  }
});

app.post("/api/wearable/revoke", authenticateUser, csrfProtection, (req: any, res) => {
  const user_uid = req.user.uid;
  try {
    db.prepare("DELETE FROM user_tokens WHERE user_uid = ? AND provider = 'google'").run(user_uid);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to revoke permissions" });
  }
});

app.get("/api/wearable/status", authenticateUser, (req: any, res) => {
  const user_uid = req.user.uid;
  const token = db.prepare("SELECT * FROM user_tokens WHERE user_uid = ? AND provider = 'google'").get(user_uid);
  res.json({ connected: !!token });
});

app.get("/api/wearable/data", authenticateUser, async (req: any, res) => {
  const user_uid = req.user.uid;
  const tokenData = db.prepare("SELECT * FROM user_tokens WHERE user_uid = ? AND provider = 'google'").get(user_uid) as any;

  if (!tokenData) {
    return res.status(404).json({ error: "Not connected to Google Fit" });
  }

  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    auth.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expiry_date: tokenData.expiry_date
    });

    const fitness = google.fitness({ version: "v1", auth });

    // Fetch last 7 days of data
    const endTime = Date.now();
    const startTime = endTime - 7 * 24 * 60 * 60 * 1000;

    const aggregate = async (dataType: string) => {
      const res = await fitness.users.dataset.aggregate({
        userId: "me",
        requestBody: {
          aggregateBy: [{ dataTypeName: dataType }],
          bucketByTime: { durationMillis: (24 * 60 * 60 * 1000).toString() },
          startTimeMillis: startTime.toString(),
          endTimeMillis: endTime.toString()
        }
      });
      return res.data.bucket;
    };

    const [steps, heartRate, sleep] = await Promise.all([
      aggregate("com.google.step_count.delta"),
      aggregate("com.google.heart_rate.summary"),
      aggregate("com.google.sleep.segment")
    ]);

    // Process data into a summary
    const summary = {
      avgSteps: steps?.reduce((acc, b) => acc + (b.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0), 0) / 7,
      avgHeartRate: heartRate?.reduce((acc, b) => acc + (b.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal || 0), 0) / 7,
      sleepHours: sleep?.reduce((acc, b) => acc + (b.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0), 0) / (7 * 3600000)
    };

    res.json(summary);
  } catch (error) {
    console.error("Google Fit data error:", error);
    res.status(500).json({ error: "Failed to fetch wearable data" });
  }
});
// Admin Routes
app.get("/api/admin/audit-logs", authenticateUser, isAdmin, (req, res) => {
  try {
    const logs = db.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100").all();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

app.get("/api/admin/stats", authenticateUser, isAdmin, (req, res) => {
  try {
    const totalRequests = db.prepare("SELECT COUNT(*) as count FROM audit_logs").get() as any;
    const modelUsage = db.prepare("SELECT model_used, COUNT(*) as count FROM audit_logs GROUP BY model_used").all();
    const uniqueUsers = db.prepare("SELECT COUNT(DISTINCT user_uid) as count FROM audit_logs").get() as any;
    
    // Simple anomaly detection: multiple requests with same input hash from different users
    const anomalies = db.prepare(`
      SELECT input_hash, COUNT(DISTINCT user_uid) as user_count, COUNT(*) as request_count 
      FROM audit_logs 
      GROUP BY input_hash 
      HAVING user_count > 1
    `).all();

    res.json({
      totalRequests: totalRequests.count,
      modelUsage,
      uniqueUsers: uniqueUsers.count,
      anomalies,
      cache: {
        hits: cacheHits,
        misses: cacheMisses,
        rate: (cacheHits + cacheMisses) > 0 ? ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const __dirname = path.resolve();
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
