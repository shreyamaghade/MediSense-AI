export const COMMON_SYMPTOMS = [
  "Fever",
  "Cough",
  "Fatigue",
  "Shortness of breath",
  "Headache",
  "Nausea",
  "Sore throat",
  "Muscle aches",
  "Loss of taste or smell",
  "Runny nose",
  "Diarrhea",
  "Chest pain",
  "Dizziness",
  "Abdominal pain",
  "Joint pain",
  "Rash",
  "Back pain",
  "Vision changes",
  "Anxiety",
  "Insomnia"
];

export interface BodyRegion {
  id: string;
  label: string;
  symptoms: string[];
  coordinates: { x: number; y: number }; // Percentage based for SVG/Div positioning
}

export const BODY_REGIONS: BodyRegion[] = [
  {
    id: "head",
    label: "Head & Face",
    symptoms: ["Headache", "Dizziness", "Vision changes", "Loss of taste or smell", "Runny nose", "Sore throat"],
    coordinates: { x: 50, y: 10 }
  },
  {
    id: "chest",
    label: "Chest",
    symptoms: ["Chest pain", "Shortness of breath", "Cough", "Heart palpitations"],
    coordinates: { x: 50, y: 25 }
  },
  {
    id: "abdomen",
    label: "Abdomen",
    symptoms: ["Abdominal pain", "Nausea", "Diarrhea", "Bloating"],
    coordinates: { x: 50, y: 40 }
  },
  {
    id: "arms",
    label: "Arms & Hands",
    symptoms: ["Joint pain", "Muscle aches", "Numbness", "Rash"],
    coordinates: { x: 25, y: 35 }
  },
  {
    id: "legs",
    label: "Legs & Feet",
    symptoms: ["Joint pain", "Muscle aches", "Swelling", "Rash"],
    coordinates: { x: 40, y: 75 }
  },
  {
    id: "back",
    label: "Back",
    symptoms: ["Back pain", "Muscle aches", "Stiffness"],
    coordinates: { x: 50, y: 55 }
  }
];
