export interface DiagnosisResult {
  condition: string;
  probability: string; // e.g., "High", "Moderate", "Low"
  description: string;
  commonSymptoms: string[];
  urgency: "Routine" | "Urgent" | "Emergency";
  probableSpecialty: string;
  nextSteps: string[];
  otcSuggestions?: string[];
  pharmacyLinks?: { name: string; url: string }[];
}

export interface DiagnosisResponse {
  possibleConditions: DiagnosisResult[];
  summary: string;
  disclaimer: string;
}

export interface Vitals {
  temperature?: string;
  bloodPressure?: string;
  heartRate?: string;
  spO2?: string;
}

export interface Demographics {
  age?: string;
  gender?: string;
  preExistingConditions?: string;
}

let csrfToken: string | null = null;

export async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  const response = await fetch('/api/csrf-token');
  const data = await response.json();
  csrfToken = data.csrfToken;
  return csrfToken;
}

export async function getDiagnosis(
  symptoms: string[], 
  additionalInfo?: string,
  vitals?: Vitals,
  demographics?: Demographics,
  wearableData?: any
): Promise<DiagnosisResponse> {
  const token = await getCsrfToken();
  
  const response = await fetch('/api/diagnose', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token || ''
    },
    body: JSON.stringify({
      symptoms,
      additionalInfo,
      vitals,
      demographics,
      wearableData
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw errorData; // Throw the whole error object { code, error, suggestion }
  }

  return response.json();
}
