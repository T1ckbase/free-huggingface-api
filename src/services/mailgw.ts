import * as url from 'node:url';
import type { Token, MailGWWrapper, Domain, MailAccount, MailMessage } from '../types/mailgw.js';
import { randomLowercaseString } from '../utils/string.js';

const BASE_URL = 'https://api.mail.gw';
const BASE_URL_2 = 'https://api.mail.tm';

export class MailGWAccountService {
  constructor(private baseUrl: string = BASE_URL) {}

  async getDomains(): Promise<Domain[]> {
    const response = await fetch(`${this.baseUrl}/domains`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`Failed to get domains: ${response.status} ${response.statusText}`);
    }
    return ((await response.json()) as MailGWWrapper<Domain>)['hydra:member'];
  }

  async createAccount(address: string, password: string = '0000'): Promise<MailGWClient> {
    const response = await fetch(`${this.baseUrl}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
    });
    if (!response.ok) {
      throw new Error(`Failed to create account: ${response.status} ${response.statusText}`);
    }
    await response.json();

    return this.loginAccount(address, password);
  }

  async loginAccount(address: string, password: string): Promise<MailGWClient> {
    const token = await this.getToken(address, password);
    return new MailGWClient(token, this.baseUrl);
  }

  async getToken(address: string, password: string): Promise<Token> {
    const response = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address, password }),
    });
    if (!response.ok) {
      throw new Error(`Failed to get token: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }
}

export class MailGWClient {
  private messageCallback?: (message: MailMessage) => void | Promise<void>;
  private pollingInterval?: NodeJS.Timeout;
  private lastMessageIds = new Set<string>();

  constructor(public token: Token, private baseUrl: string = BASE_URL) {}

  async getAccount(): Promise<MailAccount> {
    const response = await fetch(`${this.baseUrl}/accounts/${this.token.id}`, {
      headers: {
        Authorization: `Bearer ${this.token.token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to get account: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async deleteAccount(): Promise<void> {
    this.stopMessagePolling();
    const response = await fetch(`${this.baseUrl}/accounts/${this.token.id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.token.token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to delete account: ${response.status} ${response.statusText}`);
    }
  }

  async me(): Promise<MailAccount> {
    const response = await fetch(`${this.baseUrl}/me`, {
      headers: {
        Authorization: `Bearer ${this.token.token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to get account: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  async getMessages(): Promise<MailMessage[]> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      headers: {
        Authorization: `Bearer ${this.token.token}`,
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to get message: ${response.status} ${response.statusText}`);
    }
    return ((await response.json()) as MailGWWrapper<MailMessage>)['hydra:member'];
  }

  onMessage(callback: (message: MailMessage) => void | Promise<void>, pollingIntervalMs: number = 5000): void {
    this.messageCallback = callback;
    this.startMessagePolling(pollingIntervalMs);
  }

  private startMessagePolling(intervalMs: number): void {
    this.stopMessagePolling();

    this.pollingInterval = setInterval(async () => {
      try {
        const messages = await this.getMessages();
        // console.log(`Received ${messages.length} messages in polling`);

        const currentMessageIds = new Set(messages.map((msg) => msg.id));

        const newMessages = messages.filter((msg) => !this.lastMessageIds.has(msg.id));
        // console.log(`Found ${newMessages.length} new messages`);

        for (const message of newMessages) {
          // console.log(`Processing message ${message.id}`);
          this.messageCallback?.(message);
        }

        this.lastMessageIds = currentMessageIds;
        // console.log(`Updated seen message IDs, now tracking ${this.lastMessageIds.size} IDs`);
      } catch (error) {
        console.error('Error polling messages:', error);
      }
    }, intervalMs);
  }

  stopMessagePolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }
}

export async function createRandomMailAccount(maxRetries: number = 4, retryDelayMs: number = 1000): Promise<MailGWClient> {
  let attempts = 0;
  const baseUrls = [BASE_URL, BASE_URL_2];

  while (attempts < maxRetries) {
    try {
      const currentBaseUrl = baseUrls[attempts % 2];
      const mailgw = new MailGWAccountService(currentBaseUrl);
      const domains = await mailgw.getDomains();
      const { domain } = domains[Math.floor(Math.random() * domains.length)];
      const userName = randomLowercaseString(15);
      const address = `${userName}@${domain}`;
      const client = await mailgw.createAccount(address);
      await client.me();
      return client;
    } catch (error) {
      attempts++;
      if (attempts >= maxRetries) {
        throw new Error(`Failed to create mail account after ${maxRetries} attempts: ${error}`);
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw new Error('Failed to create mail account: max retries exceeded');
}

async function main() {
  // const mailgw = new MailGWAccountService('https://api.mail.tm');
  // const domains = await mailgw.getDomains();
  // const domain = domains[Math.floor(Math.random() * domains.length)].domain;
  // // console.log(domain);
  // const userName = randomLowercaseString(12);
  // const address = `${userName}@${domain}`;
  // console.log(address);
  // const client = await mailgw.createAccount(address);
  // // const account = await client.getAccount();
  // const account = await client.me();
  // console.log(account);

  const client = await createRandomMailAccount();
  const account = await client.me();
  console.log(account.address);

  client.onMessage((message) => {
    console.log('New message received:', message);
  });

  setTimeout(async () => {
    client.stopMessagePolling();
    await client.deleteAccount();
    console.log('Stopped message polling');
  }, 600000);
}

if (url.fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
