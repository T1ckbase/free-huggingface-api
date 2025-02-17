import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';

const BASE_URL = 'https://router.huggingface.co';

import './services/playwright.ts';

const app = new Hono();

app.use('*', logger());
app.get('/', (c) => {
  return c.text('Hello Hono!');
});

app.post('*', async (c) => {
  const url = new URL(c.req.url);
  const targetPath = url.pathname + url.search;
  const targetUrl = `${BASE_URL}${targetPath}`;

  const headers = new Headers(c.req.raw.headers);
  headers.set('Authorization', `Bearer ${TODO}`);
  headers.get('x-use-cache') || headers.set('x-use-cache', 'false');

  return await fetch(targetUrl, {
    method: 'POST',
    headers: headers,
    body: c.req.raw.body,
  });
});

const port = 7860;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port: port,
});
