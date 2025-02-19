import { GitHubKVStore } from './kv.js';
import { createHuggingFaceToken } from './playwright.js';
import { logger } from '../logger.js';
import { config } from '../config.js';

/**
 * Manages HuggingFace API keys and handles API requests
 * Maintains a local cache of keys and persists them to cloud storage
 */
export class HuggingFaceHandler {
  private keys: (string | null)[] = [];
  private isCreatingKey = false;
  private lastCreationAttempt = 0;
  private readonly storageKey: string;
  private isInitialized = false;

  constructor(private readonly kv: GitHubKVStore, storageKey: string = 'huggingface_api_keys') {
    this.storageKey = storageKey;
  }

  /**
   * Initializes the key array from cloud storage
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const stored = await this.kv.get(this.storageKey);
      if (stored) {
        this.keys = JSON.parse(stored);
        logger.info(`Initialized with ${this.getActiveKeyCount()} active keys`);
      }
      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize keys from storage:', error);
      throw new Error('Key initialization failed');
    }
  }

  /**
   * Handles incoming API requests by trying available keys
   */
  async handleRequest(url: string, headers: Headers, body: ReadableStream<Uint8Array> | null): Promise<Response> {
    await this.initialize();

    if (this.getActiveKeyCount() === 0) {
      this.createKey();
      return new Response('No API keys available', { status: 503 });
    }

    // Create an array of body streams for each potential request
    const bodyStreams: (ReadableStream<Uint8Array> | null)[] = [];
    if (body) {
      // Tee the original stream into enough copies for all keys
      let currentStream = body;
      for (let i = 0; i < this.keys.length; i++) {
        if (!this.keys[i]) continue;
        const [stream1, stream2] = currentStream.tee();
        bodyStreams.push(stream1);
        currentStream = stream2;
      }
    }

    // Try each active key
    let streamIndex = 0;
    for (let i = 0; i < this.keys.length; i++) {
      const key = this.keys[i];
      if (!key) continue;

      const currentBody = body ? bodyStreams[streamIndex++] : null;
      const response = await this.tryRequest(url, headers, currentBody, key, i);
      if (response) return response;
    }

    return new Response('All API keys depleted', { status: 503 });
  }

  /**
   * Attempts an API request with a specific key
   */
  private async tryRequest(url: string, headers: Headers, body: ReadableStream<Uint8Array> | null, key: string, index: number): Promise<Response | null> {
    const requestHeaders = new Headers(headers);
    requestHeaders.set('Authorization', `Bearer ${key}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body,
        // @ts-ignore
        duplex: 'half',
      });

      // Only handle 402 errors specifically
      if (response.status === 402) {
        logger.warn(`API key deprecated: ${key}`);
        await this.deprecateKey(index);
        return null;
      }

      this.ensureMinimumKeys();
      return response;
    } catch (error) {
      logger.error(`Request failed with key ${index + 1}:`, error);
      return null;
    }
  }

  /**
   * Creates a new API key and adds it to the first null slot
   */
  private async createKey(): Promise<string | null> {
    if (this.isCreatingKey) {
      if (Date.now() - this.lastCreationAttempt > config.keys.lockTimeout) {
        this.isCreatingKey = false;
      } else {
        logger.info('Key creation already in progress');
        return null;
      }
    }

    this.isCreatingKey = true;
    this.lastCreationAttempt = Date.now();

    try {
      const key = await createHuggingFaceToken();
      const index = this.keys.findIndex((k) => k === null);

      if (index === -1) {
        this.keys.push(key);
      } else {
        this.keys[index] = key;
      }

      const activeCount = this.getActiveKeyCount();
      logger.info(`Added new key. Active keys: ${activeCount}`);

      // Only persist when reaching the target count
      if (activeCount === config.keys.minCount) {
        await this.persistKeys();
      } else if (activeCount < config.keys.minCount) {
        // Create another key if we haven't reached the target count
        setTimeout(() => {
          this.createKey().catch((error) => {
            logger.warn('Failed to create additional key:', error);
          });
        }, 1000); // Add a small delay between creations
      }

      return key;
    } catch (error) {
      logger.error('Failed to create key:', error);
      return null;
    } finally {
      this.isCreatingKey = false;
    }
  }

  /**
   * Marks a key as deprecated by setting it to null
   */
  private async deprecateKey(index: number): Promise<void> {
    if (index < 0 || index >= this.keys.length) return;

    this.keys[index] = null;
    const activeCount = this.getActiveKeyCount();
    logger.info(`Deprecated key at index ${index}. Active keys: ${activeCount}`);
  }

  /**
   * Ensures the minimum number of keys is maintained
   */
  private async ensureMinimumKeys(): Promise<void> {
    if (this.getActiveKeyCount() < config.keys.minCount) {
      this.createKey().catch((error) => {
        logger.warn('Failed to create new key:', error);
      });
    }
  }

  /**
   * Persists the current key array to cloud storage
   */
  private async persistKeys(): Promise<void> {
    try {
      await this.kv.set(this.storageKey, JSON.stringify(this.keys));
      logger.info(`Persisted ${this.getActiveKeyCount()} active keys to storage`);
    } catch (error) {
      logger.error('Failed to persist keys:', error);
      throw new Error('Failed to persist keys to storage');
    }
  }

  /**
   * Returns the count of non-null keys
   */
  private getActiveKeyCount(): number {
    return this.keys.filter((key) => key !== null).length;
  }
}
