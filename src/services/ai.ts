import 'dotenv/config';
import { google } from '@ai-sdk/google';
import { generateObject, type DataContent } from 'ai';
import { z } from 'zod';

export async function findItemPositionsInGrid(item: string, image: DataContent | URL): Promise<number[]> {
  const prompt = `Analyze the provided image, which is a 3x3 grid. Identify all instances of "${item}" and provide their corresponding indices. The indices are numbered from 0 to 8, starting from the top-left cell and proceeding left-to-right, top-to-bottom.`;
  const { object } = await generateObject({
    model: google('gemini-2.0-flash', {
      safetySettings: [
        {
          category: 'HARM_CATEGORY_CIVIC_INTEGRITY',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_NONE',
        },
      ]
    }),
    schema: z.array(z.number()),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image', image },
        ],
      },
    ],
    maxRetries: 20,
  });

  return object;
}
