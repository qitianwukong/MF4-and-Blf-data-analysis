import { GoogleGenAI, Type } from "@google/genai";
import { SignalMetadata, GeminiAnalysisResult } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is not set in environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeVehicleData = async (
  filename: string,
  signals: SignalMetadata[]
): Promise<GeminiAnalysisResult> => {
  const ai = getClient();

  const prompt = `
    You are an expert automotive data engineer. Analyze the following statistical summary of vehicle signal data derived from a log file named "${filename}".
    
    Data Summary:
    ${JSON.stringify(signals, null, 2)}

    Please provide:
    1. A brief executive summary of the vehicle's operating state.
    2. Potential anomalies (e.g., if temperatures are too high, voltage too low, or inconsistent speed/rpm ratios based on general automotive knowledge).
    3. Recommendations for further inspection.

    Return the response in JSON format.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            anomalies: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            recommendations: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
          },
          required: ["summary", "anomalies", "recommendations"],
        },
      },
    });

    if (response.text) {
      return JSON.parse(response.text) as GeminiAnalysisResult;
    }
    throw new Error("Empty response from Gemini");
  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    throw error;
  }
};