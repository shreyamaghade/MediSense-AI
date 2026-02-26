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

export function validateVitals(vitals?: Vitals): { valid: boolean; error?: string; suggestion?: string } {
  if (!vitals) return { valid: true };

  const temp = parseFloat(vitals.temperature || "");
  if (vitals.temperature && !isNaN(temp) && (temp < 30 || temp > 45)) {
    return { 
      valid: false,
      error: "The temperature provided is outside of physiological limits.",
      suggestion: "Please double-check your thermometer reading and try again."
    };
  }

  if (vitals.bloodPressure) {
    const bpParts = vitals.bloodPressure.split('/');
    if (bpParts.length === 2) {
      const systolic = parseInt(bpParts[0]);
      const diastolic = parseInt(bpParts[1]);
      if (systolic < diastolic || systolic > 300 || diastolic < 20) {
        return {
          valid: false,
          error: "The blood pressure reading appears to be invalid.",
          suggestion: "Ensure systolic (top number) is higher than diastolic (bottom number) and re-enter."
        };
      }
    }
  }

  return { valid: true };
}

export function selectModel(symptoms: string[], additionalInfo?: string, demographics?: Demographics): string {
  const isComplex = 
    (additionalInfo && additionalInfo.length > 200) || 
    (demographics?.preExistingConditions && demographics.preExistingConditions.length > 50) ||
    symptoms.length > 5;

  return isComplex ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";
}

export function calculateRiskScore(conditions: any[]): 'Routine' | 'Urgent' | 'Emergency' {
  const levels = { 'Emergency': 3, 'Urgent': 2, 'Routine': 1 };
  return conditions.reduce((prev, curr) => {
    return levels[curr.urgency as keyof typeof levels] > levels[prev as keyof typeof levels] ? curr.urgency : prev;
  }, 'Routine');
}
