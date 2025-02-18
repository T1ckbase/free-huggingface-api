import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import { GitHubKVStore } from './services/kv.js';
import { KeyManager } from './services/key-manager.js';
import { rot13 } from './utils/string.js';

const BASE_URL = 'https://router.huggingface.co';

const kv = new GitHubKVStore({
  token: process.env.GITHUB_ACCESS_TOKEN!,
  owner: process.env.GITHUB_USERNAME!,
  repo: process.env.GITHUB_REPO!,
  extraEncoding: rot13,
});

const keyManager = new KeyManager(kv);

const app = new Hono();

app.use('*', honoLogger());
app.get('/', (c) => {
  return c.text('Hello Hono!');
});

app.post('*', async (c) => {
  const url = new URL(c.req.url);
  const targetPath = url.pathname + url.search;
  const targetUrl = `${BASE_URL}${targetPath}`;

  return await keyManager.handleRequest(targetUrl, c.req.raw.headers, c.req.raw.body);
});

const port = 7860;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port: port,
});
