import { z } from 'zod';
import 'dotenv/config';

const configSchema = z.object({
  github: z.object({
    token: z.string(),
    username: z.string(),
    repo: z.string(),
  }),
  server: z.object({
    port: z.number().default(7860),
    baseUrl: z.string().default('https://router.huggingface.co'),
  }),
  keys: z.object({
    minCount: z.number().default(5),
    creationTimeout: z.number().default(5 * 60 * 1000),
    lockTimeout: z.number().default(30 * 1000),
  }),
});

export const config = configSchema.parse({
  github: {
    token: process.env.GITHUB_ACCESS_TOKEN,
    username: process.env.GITHUB_USERNAME,
    repo: process.env.GITHUB_REPO,
  },
  server: {
    port: Number(process.env.PORT) || 7860,
    baseUrl: process.env.BASE_URL || 'https://router.huggingface.co',
  },
  keys: {
    minCount: Number(process.env.MIN_API_KEYS) || 5,
    creationTimeout: Number(process.env.KEY_CREATION_TIMEOUT) || 5 * 60 * 1000,
    lockTimeout: Number(process.env.KEY_CREATION_LOCK_TIMEOUT) || 30 * 1000,
  },
});
