import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("GEMINI_API_KEY is not defined in the environment. AI features may fail.");
}

export const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export async function analyzeFoodImage(base64Image: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        {
          parts: [
            { text: "Analyze this image of food surplus. Estimate the number of full meals that could be redistributed from this surplus. Return only the number." },
            { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
          ]
        }
      ]
    });
    
    const text = response.text || "0";
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  } catch (error: any) {
    if (error?.message?.includes('403') || error?.message?.includes('permission')) {
      throw new Error("Gemini API Permission Denied. Please check your API key in the settings.");
    }
    if (error?.message?.includes('404') || error?.message?.includes('not found')) {
      throw new Error("Gemini Model Not Found. Please contact support or check model availability.");
    }
    throw error;
  }
}

export async function getDecisionExplanation(data: any, language: string = 'en') {
  const prompt = `
    As an Autonomous Food Waste Redistribution Agent, explain the following decision to the user in a friendly, professional chatbot style:
    Language: ${language === 'kn' ? 'Kannada' : 'English'}
    
    Data:
    - Past Sales: ${data.pastSales}
    - Time of Day: ${data.timeOfDay}
    - Predicted Demand: ${data.predictedDemand}
    - Surplus Detected: ${data.surplus}
    - Recommended Action: ${data.recommendedAction}
    - Suggested Partner: ${data.ngo.name} (${data.ngo.distance}km away)
    
    Provide a concise explanation of why this action was recommended and how it helps reduce food waste.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
    });

    return response.text || "I've analyzed the data and recommended the best course of action to minimize waste.";
  } catch (error: any) {
    if (error?.message?.includes('403') || error?.message?.includes('permission')) {
      return "AI Explanation unavailable: Permission Denied. Please check your API key.";
    }
    if (error?.message?.includes('404') || error?.message?.includes('not found')) {
      return "AI Explanation unavailable: Model Not Found.";
    }
    throw error;
  }
}

export async function getChatbotResponse(message: string, history: any[], language: string = 'en') {
  const systemInstruction = `
    You are the EcoFeast AI Assistant. You help users manage food waste and redistribution.
    Users can be Donors (restaurants/hotels) or Receivers (NGOs/orphanages/feed makers).
    You can answer questions about:
    - Food storage and safety.
    - Surplus management and AI predictions.
    - Redistribution to partners (NGOs, Orphanages, Pet Feed makers, Fertilizer makers).
    - How to use the app's features (Dashboard, About, FAQ, Contact, Support).
    
    Current Language: ${language === 'kn' ? 'Kannada' : 'English'}
    Always respond in the requested language.
    Be helpful, encouraging, and focused on sustainability.
  `;

  const contents = [
    ...history.map(h => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: message }] }
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: contents as any,
      config: {
        systemInstruction
      }
    });
    return response.text;
  } catch (error: any) {
    console.error("Gemini chatbot error:", error);
    if (error?.message?.includes('403') || error?.message?.includes('permission')) {
      return language === 'kn' ? "ಕ್ಷಮಿಸಿ, ಅನುಮತಿ ನಿರಾಕರಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ API ಕೀಲಿಯನ್ನು ಪರಿಶೀಲಿಸಿ." : "I'm sorry, permission denied. Please check your Gemini API key in the settings.";
    }
    if (error?.message?.includes('404') || error?.message?.includes('not found')) {
      return language === 'kn' ? "ಕ್ಷಮಿಸಿ, ಮಾದರಿ ಕಂಡುಬಂದಿಲ್ಲ." : "I'm sorry, the AI model was not found.";
    }
    return language === 'kn' ? "ಕ್ಷಮಿಸಿ, ಈಗ ಉತ್ತರಿಸಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ." : "I'm sorry, I cannot respond right now.";
  }
}
