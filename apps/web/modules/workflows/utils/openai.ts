import { ChatOpenAI } from '@langchain/openai';

// Initialize OpenAI client with API key from environment
export function createChatModel(options?: {
  temperature?: number;
  modelName?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return new ChatOpenAI({
    openAIApiKey: apiKey,
    modelName: options?.modelName || 'gpt-4-turbo-preview',
    temperature: options?.temperature ?? 0.3,
    modelKwargs: {
      response_format: { type: 'json_object' },
    },
  });
}

// Helper to parse JSON responses safely
export function parseJSONResponse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse JSON response:', content);
    throw new Error('Invalid JSON response from AI model');
  }
} 