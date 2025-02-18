import { GitHubKVStore } from './kv.js';
import { createHuggingFaceToken } from './playwright.js';
import { logger } from '../logger.js';

const MIN_API_KEYS = 5;
const API_KEYS_KEY = 'huggingface_api_keys';
const KEY_CREATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes timeout for key creation

export class KeyManager {
  private currentApiKeys: string[] = [];
  private kv: GitHubKVStore;
  private isCreatingKey = false;
  private keyCreationPromise: Promise<string> | null = null;
  private keyCreationTimeout: NodeJS.Timeout | null = null;

  constructor(kv: GitHubKVStore) {
    this.kv = kv;
    // Initialize keys on startup
    this.getApiKeys().catch((error) => {
      logger.error('Failed to initialize API keys:', error);
    });
  }

  private logKeyCount() {
    logger.info(`Current API key count: ${this.currentApiKeys.length}`);
  }

  async getApiKeys(): Promise<string[]> {
    // If we have keys in memory and they're not empty, use them
    if (this.currentApiKeys.length > 0) {
      this.logKeyCount();
      return [...this.currentApiKeys]; // Return a copy to prevent external modifications
    }

    try {
      const storedKeys = await this.kv.get(API_KEYS_KEY);
      if (storedKeys) {
        this.currentApiKeys = JSON.parse(storedKeys);
        this.logKeyCount();
        return [...this.currentApiKeys];
      }
      logger.warn('No API keys found in storage');
      return [];
    } catch (error) {
      logger.error('Failed to get API keys from storage:', error);
      return this.currentApiKeys; // Return current keys if storage fails
    }
  }

  private async saveApiKeys(keys: string[]) {
    try {
      this.currentApiKeys = [...keys]; // Create a copy
      await this.kv.set(API_KEYS_KEY, JSON.stringify(keys));
      this.logKeyCount();
    } catch (error) {
      logger.error('Failed to save API keys:', error);
      throw error;
    }
  }

  private clearKeyCreationState() {
    this.isCreatingKey = false;
    this.keyCreationPromise = null;
    if (this.keyCreationTimeout) {
      clearTimeout(this.keyCreationTimeout);
      this.keyCreationTimeout = null;
    }
  }

  /**
   * Initiates background creation of a new API key.
   * This is a non-blocking operation that will add the key to the pool when ready.
   */
  private initiateKeyCreation(): void {
    if (this.isCreatingKey) {
      return;
    }

    this.isCreatingKey = true;

    // Start key creation in the background
    (async () => {
      try {
        const newToken = await createHuggingFaceToken();
        const keys = await this.getApiKeys();

        if (!keys.includes(newToken)) {
          keys.push(newToken);
          await this.saveApiKeys(keys);
          logger.info('Successfully added new API key to the pool');
        }
      } catch (error) {
        logger.error('Failed to create new API key:', error);
      } finally {
        this.clearKeyCreationState();
      }
    })().catch((error) => {
      logger.error('Unexpected error in key creation:', error);
      this.clearKeyCreationState();
    });
  }

  /**
   * Ensures the minimum number of API keys are maintained.
   * This is a non-blocking operation that initiates key creation in the background.
   */
  async ensureMinimumKeys(): Promise<void> {
    const keys = await this.getApiKeys();
    const needed = MIN_API_KEYS - keys.length;

    if (needed > 0 && !this.isCreatingKey) {
      logger.info(`Initiating creation of ${needed} new API keys in the background`);
      this.initiateKeyCreation();
    }
  }

  async removeKey(index: number): Promise<void> {
    const keys = await this.getApiKeys();
    if (index >= 0 && index < keys.length) {
      keys.splice(index, 1);
      await this.saveApiKeys(keys);
      logger.warn(`Removed API key at index ${index}, ${keys.length} keys remaining`);

      // Trigger background key creation if running low
      if (keys.length < MIN_API_KEYS) {
        this.ensureMinimumKeys().catch((error) => {
          logger.error('Failed to initiate key creation after removal:', error);
        });
      }
    }
  }

  async handleRequest(url: string, headers: Headers, body: ReadableStream<Uint8Array> | null): Promise<Response> {
    let keys = await this.getApiKeys();

    // If no keys available at all, we have to wait for a new one
    if (keys.length === 0) {
      logger.warn('No API keys available, creating initial key');
      try {
        const newToken = await createHuggingFaceToken();
        keys = [newToken];
        await this.saveApiKeys(keys);
      } catch (error) {
        logger.error('Failed to create initial API key:', error);
        return new Response('No API keys available', { status: 503 });
      }
    }

    let currentKeyIndex = 0;
    let lastResponse: Response | null = null;

    // Try each available key
    while (currentKeyIndex < keys.length) {
      const requestHeaders = new Headers(headers);
      requestHeaders.set('Authorization', `Bearer ${keys[currentKeyIndex]}`);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: requestHeaders,
          body: body,
          // @ts-ignore
          duplex: 'half',
        });

        lastResponse = response;

        if (response.status !== 402) {
          // If we're running low on keys, trigger background key creation
          if (keys.length < MIN_API_KEYS) {
            this.ensureMinimumKeys().catch((error) => {
              logger.error('Failed to ensure minimum keys:', error);
            });
          }
          return response;
        }

        // Remove the depleted key
        logger.warn(`API key ${currentKeyIndex + 1}/${keys.length} depleted, removing it`);
        await this.removeKey(currentKeyIndex);
        keys = await this.getApiKeys();
      } catch (error) {
        logger.error(`Request failed with key ${currentKeyIndex + 1}/${keys.length}:`, error);
        currentKeyIndex++;
      }
    }

    return lastResponse || new Response('All API keys depleted', { status: 402 });
  }
}
