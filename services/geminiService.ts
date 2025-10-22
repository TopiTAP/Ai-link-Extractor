import { GoogleGenAI } from "@google/genai";

const model = 'gemini-flash-lite-latest';

export async function extractLinksStream(text: string, apiKey: string) {
  // Check for the API key at the time of the request.
  if (!apiKey) {
    throw new Error("API Key not provided. Please enter your API key to use this service.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  if (!text.trim()) {
    throw new Error("Input text cannot be empty.");
  }
  
  const prompt = `From the following text, extract all URLs.
Return ONLY the URLs, each on a new line.
Do not include any introductory text, explanations, or markdown formatting like backticks.

Example:
Input: "Check out https://google.com and also http://example.com/page for more info."
Output:
https://google.com
http://example.com/page

TEXT TO PROCESS:
---
${text}
---
`;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: model,
      contents: prompt,
    });
    return responseStream;
  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
     if (error.message && error.message.includes('API key not valid')) {
        throw new Error("The provided API Key is invalid. Please check and correct it.");
    }
    // A 404 can indicate an invalid API key or project setup for the model.
     if (error.message && error.message.includes('was not found')) {
        throw new Error("The AI model could not be reached. This may be due to an invalid API key or a service issue. Please verify your key.");
    }
    throw new Error("Failed to communicate with the AI. Please check your API key and network connection.");
  }
}