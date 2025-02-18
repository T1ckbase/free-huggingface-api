import * as url from 'node:url';
import { chromium, devices } from 'playwright';
import { createRandomMailAccount } from './mailgw.js';
import { randomString, randomPassword, extractUrls } from '../utils/string.js';
import { getRandomCatImage } from './cat.js';
import { findItemPositionsInGrid } from './ai.js';
import { logger } from '../logger.js';

export async function createHuggingFaceToken(): Promise<string> {
  return new Promise(async (resolve, reject) => {
    logger.info('Starting HuggingFace token creation process');
    const client = await createRandomMailAccount(6, 10000);
    const { address } = await client.me();
    logger.info(`Created random mail account: ${address}`);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ ...devices['Desktop Chrome'], colorScheme: 'dark', viewport: { width: 1920, height: 1080 } });
    let timeoutId: NodeJS.Timeout | null = null;
    try {
      logger.info('Launching browser and setting up context');
      await context.addInitScript({ path: 'src/scripts/anti-bot-detection.js' });

      const page = await context.newPage();
      await page.goto('https://huggingface.co/join', { waitUntil: 'networkidle' });
      logger.info('Navigated to HuggingFace join page');

      let attempts = 0;
      while (attempts < 5) {
        try {
          for (let i = 0; i < 3; i++) {
            try {
              await page.locator('#amzn-captcha-verify-button').click({ timeout: 1000 });
              break;
            } catch {
              logger.warn('Captcha button not found, retrying...');
              await page.reload({ waitUntil: 'networkidle' });
            }
          }
          const item = await page.locator('form em').innerText();
          logger.info(`Solving captcha for item: ${item}`);
          await page.waitForTimeout(500);
          const image = await page.locator('canvas').screenshot();
          const indices = await findItemPositionsInGrid(item, image);
          logger.info(`Found item positions: ${indices.join(', ')}`);

          for (const index of indices) {
            await page.evaluate(`document.querySelector("canvas > button:nth-child(${index + 1})").click()`);
            await page.waitForTimeout(100);
          }
          await page.locator('#amzn-btn-verify-internal').click();
          await page.locator('form input[name="email"]').waitFor({ timeout: 7000 });
          logger.info('Successfully solved captcha');
          break; // If we reach here, captcha was successful
        } catch {
          attempts++;
          logger.warn(`Captcha verification failed, attempt ${attempts} of 5`);
          if (attempts >= 5) {
            const error = new Error('Failed to verify captcha after 5 attempts');
            logger.error(error.message);
            reject(error);
            return;
          }
          await page.reload({ waitUntil: 'networkidle' });
        }
      }

      await page.waitForTimeout(1000);
      const password = randomPassword(12);
      logger.info(`Starting account creation process email: ${address}, password: ${password}`);
      await page.locator('form input[name="email"]').fill(address);
      await page.locator('form input[name="password"]').fill(password);
      await page.getByRole('button', { name: 'Next' }).click();

      const username = crypto.randomUUID(); // randomString(15);
      logger.info(`Creating account with username: ${username}`);
      await page.locator('form input[name="username"]').fill(username);
      await page.locator('form input[name="fullname"]').fill(username);
      await page.locator('form input[type="file"]').setInputFiles({
        name: 'cat.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from(new Uint8Array(await getRandomCatImage())),
      });
      logger.info('Uploaded profile picture');
      await page.waitForTimeout(2000);
      await page.getByText('Upload file').waitFor();
      await page.locator('form input[type="checkbox"]').check();
      await page.getByRole('button', { name: 'Create Account' }).click();
      logger.info('Submitted account creation form');

      logger.info('Waiting for confirmation email');
      client.onMessage(async ({ from, subject, intro }) => {
        try {
          if (from.name !== 'huggingface' || !subject.includes('confirm')) return;
          logger.info('Received confirmation email from HuggingFace');

          const urls = extractUrls(intro);
          if (urls.length === 0) {
            const error = new Error('No confirmation URL found in email from HuggingFace');
            logger.error(error.message);
            reject(error);
            return;
          }

          logger.info('Clicking confirmation link');
          await page.goto(urls[0], { waitUntil: 'load' });
          await page.goto('https://huggingface.co/settings/tokens/new?tokenType=fineGrained', { waitUntil: 'load' });
          logger.info('Navigated to token creation page');

          const tokenName = randomString(15);
          logger.info(`Creating token with name: ${tokenName}`);
          await page.locator('form input[name="displayName"]').fill(tokenName);
          await page.locator('form input[type="checkbox"][value="inference.serverless.write"]').first().check();
          await page.locator('form input[type="checkbox"][value="inference.endpoints.infer.write"]').first().check();
          await page.locator('form input[type="checkbox"][value="inference.endpoints.write"]').first().check();
          await page.getByRole('button', { name: 'Create token' }).click();
          logger.info('Submitted token creation form');

          const token = await page.locator('form input[readonly]').inputValue();
          logger.info('Successfully created token');

          await client.deleteAccount();
          logger.info('Cleaned up temporary email account');
          resolve(token);
        } catch (error) {
          logger.error('Error during token creation:', error);
          reject(error);
        } finally {
          logger.info('Closing browser');
          await context.close();
          await browser.close();
          if (timeoutId) clearTimeout(timeoutId);
        }
      });

      timeoutId = setTimeout(async () => {
        logger.error('Timeout waiting for confirmation email, cleaning up account');
        await client.deleteAccount();
        reject(new Error('Timeout waiting for confirmation email'));
      }, 60000);
    } catch (error) {
      logger.error('Error during account creation:', error);
      reject(error);
      await context.close();
      await browser.close();
      if (timeoutId) clearTimeout(timeoutId);
    }
  });
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ ...devices['Desktop Chrome'], colorScheme: 'dark' });

  await context.addInitScript({ path: 'src/scripts/anti-bot-detection.js' });

  const page = await context.newPage();
  // const page2 = await context.newPage();

  // await page.goto('https://bot.sannysoft.com');
  // await page.goto('https://www.browserscan.net/bot-detection');
  // await page.goto('https://fingerprintjs.github.io/BotD/main/');
  await page.goto('https://huggingface.co/join', { waitUntil: 'networkidle' });
  // await page.locator('a[href="/join"]').first().click();
  while (true) {
    try {
      await page.locator('#amzn-captcha-verify-button').click({ timeout: 1000 });
      break;
    } catch {
      console.log('Captcha button not found, retrying...');
      await page.reload({ waitUntil: 'networkidle' });
    }
  }

  const item = await page.locator('form em').innerText();
  await page.waitForTimeout(500);
  const image = await page.locator('canvas').screenshot();
  const indices = await findItemPositionsInGrid(item, image);
  console.log(indices);
  for (const index of indices) {
    await page.evaluate(`document.querySelector("canvas > button:nth-child(${index + 1})").click()`);
    await page.waitForTimeout(100);
  }

  await page.pause();

  await context.close();
  await browser.close();
}

if (url.fileURLToPath(import.meta.url) === process.argv[1]) {
  // await main();
  console.log('token:', await createHuggingFaceToken());
}
