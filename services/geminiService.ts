
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// This service is a placeholder for Gemini API interactions.
// It's not used in the current core logic of the Gmail draft automation
// but is included as per the expertise requirement.

export class GeminiService {
  private static instance: GeminiService;
  private ai: GoogleGenAI | null = null; // Initialize as null
  private readonly TEXT_MODEL = 'gemini-2.5-flash-preview-04-17';
  private readonly IMAGE_MODEL = 'imagen-3.0-generate-002';
  private apiKeyExists: boolean = false;

  private constructor() {
    const apiKey = process.env.API_KEY; // Use process.env.API_KEY as per guidelines
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
      this.apiKeyExists = true;
    } else {
      console.warn("API_KEY is not set in environment variables for GeminiService. GeminiService will not function."); // Updated warning
      this.apiKeyExists = false;
    }
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  private ensureInitialized(): boolean {
    if (!this.ai || !this.apiKeyExists) {
      console.error("GeminiService is not initialized or API key is missing.");
      return false;
    }
    return true;
  }

  public async generateText(prompt: string, systemInstruction?: string): Promise<string> {
    if (!this.ensureInitialized()) return "Gemini API Key not configured or service not initialized.";
    
    try {
      const response: GenerateContentResponse = await this.ai!.models.generateContent({ // Non-null assertion due to ensureInitialized
        model: this.TEXT_MODEL,
        contents: prompt,
        ...(systemInstruction && { config: { systemInstruction } }),
      });
      return response.text;
    } catch (error) {
      console.error("Error generating text with Gemini:", error);
      throw error;
    }
  }

  public async generateTextStream(
    prompt: string,
    onChunk: (chunkText: string) => void,
    onError: (error: any) => void,
    onComplete: () => void,
    systemInstruction?: string
  ): Promise<void> {
    if (!this.ensureInitialized()) {
        onError(new Error("Gemini API Key not configured or service not initialized."));
        onComplete();
        return;
    }
    try {
      // Use AsyncIterable<GenerateContentResponse> if GenerateContentStreamResponse is not found
      const response: AsyncIterable<GenerateContentResponse> = await this.ai!.models.generateContentStream({ // Non-null assertion
        model: this.TEXT_MODEL,
        contents: prompt,
        ...(systemInstruction && { config: { systemInstruction } }),
      });

      for await (const chunk of response) {
        onChunk(chunk.text);
      }
      onComplete();
    } catch (error) {
      console.error("Error generating text stream with Gemini:", error);
      onError(error);
      onComplete(); 
    }
  }

  public async generateImage(prompt: string): Promise<string | null> {
     if (!this.ensureInitialized()) {
        console.error("API Key for image generation not configured or service not initialized.");
        return null;
    }
    try {
        const response = await this.ai!.models.generateImages({ // Non-null assertion
            model: this.IMAGE_MODEL,
            prompt: prompt,
            config: {numberOfImages: 1, outputMimeType: 'image/jpeg'},
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        return null;
    } catch (error) {
        console.error("Error generating image with Imagen:", error);
        throw error;
    }
  }
  
  public async generateJsonData<T,>(prompt: string): Promise<T | null> {
    if (!this.ensureInitialized()) return null;
    try {
      const response = await this.ai!.models.generateContent({ // Non-null assertion
        model: this.TEXT_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      let jsonStr = response.text.trim();
      const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
      const match = jsonStr.match(fenceRegex);
      if (match && match[2]) {
        jsonStr = match[2].trim();
      }
      return JSON.parse(jsonStr) as T;
    } catch (error) {
      console.error("Error generating JSON with Gemini:", error);
      // It's better to throw the error or return a result indicating error,
      // rather than returning null which can be ambiguous.
      // For now, sticking to existing pattern of returning null.
      throw error; 
    }
  }
}
