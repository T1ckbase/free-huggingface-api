import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger as honoLogger } from 'hono/logger';
import { GitHubKVStore } from './services/kv.js';
import { HuggingFaceHandler } from './services/huggingface.js';
import { rot13 } from './utils/string.js';
import { config } from './config.js';

const kv = new GitHubKVStore({
  token: config.github.token,
  owner: config.github.username,
  repo: config.github.repo,
  extraEncoding: rot13,
});

const huggingFaceHandler = new HuggingFaceHandler(kv);

const app = new Hono();

app.use('*', honoLogger());
app.get('/', (c) => c.text('Hello Hono!'));

app.post('*', async (c) => {
  const url = new URL(c.req.url);
  const targetUrl = `${config.server.baseUrl}${url.pathname}${url.search}`;
  return await huggingFaceHandler.handleRequest(targetUrl, c.req.raw.headers, c.req.raw.body);
});

console.log(`Server is running on http://localhost:${config.server.port}\n`);

serve({
  fetch: app.fetch,
  port: config.server.port,
});
