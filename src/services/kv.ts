import 'dotenv/config';
import * as url from 'node:url';
import { Octokit } from '@octokit/rest';
import { rot13 } from '../utils/string.js';
import { logger } from '../logger.js';

interface KVStoreConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
  extraEncoding?: (value: string) => string;
}

export class GitHubKVStore {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private branch: string;
  private extraEncoding?: (value: string) => string;

  constructor(config: KVStoreConfig) {
    this.octokit = new Octokit({
      auth: config.token,
      log: {
        debug(_) {},
        info(_) {},
        warn(_) {},
        error(_) {},
      },
    });
    this.owner = config.owner;
    this.repo = config.repo;
    this.branch = config.branch || 'main';
    this.extraEncoding = config.extraEncoding;
  }

  private getPath(key: string): string {
    // Sanitize key: remove leading/trailing slashes, replace invalid chars
    return key.replace(/^\/+|\/+$/g, '').replace(/[^a-zA-Z0-9-_/.]/g, '_');
  }

  private encode(value: string): string {
    let encoded = value;
    if (this.extraEncoding) {
      encoded = this.extraEncoding(encoded);
    }
    return Buffer.from(encoded).toString('base64');
  }

  private decode(value: string): string {
    let decoded = Buffer.from(value, 'base64').toString();
    if (this.extraEncoding) {
      decoded = this.extraEncoding(decoded); // Same function since we expect it to be reversible
    }
    return decoded;
  }

  async set(key: string, value: string): Promise<boolean> {
    try {
      const contentBase64 = this.encode(value);
      const path = this.getPath(key);

      let sha: string | undefined;
      try {
        const { data } = await this.octokit.rest.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path,
        });

        if (!Array.isArray(data)) {
          sha = data.sha;
        }
      } catch (e) {
        // File doesn't exist yet, that's ok
      }

      await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message: `Update key: ${key}`,
        content: contentBase64,
        sha,
        branch: this.branch,
      });

      return true;
    } catch (error) {
      logger.error('Error setting value:', error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: this.getPath(key),
      });

      if (Array.isArray(data)) {
        throw new Error('Unexpected directory found instead of file');
      }

      if (data.type !== 'file') {
        throw new Error('Unexpected non-file content');
      }

      return this.decode(data.content);
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 404) {
        return null;
      }
      logger.error('Error getting value:', error);
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const path = this.getPath(key);
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
      });

      if (Array.isArray(data)) {
        throw new Error('Unexpected directory found instead of file');
      }

      await this.octokit.rest.repos.deleteFile({
        owner: this.owner,
        repo: this.repo,
        path,
        message: `Delete key: ${key}`,
        sha: data.sha,
        branch: this.branch,
      });

      return true;
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 404) {
        return false;
      }
      logger.error('Error deleting value:', error);
      throw error;
    }
  }
}

async function main() {
  const kv = new GitHubKVStore({
    token: process.env.GITHUB_ACCESS_TOKEN!,
    owner: process.env.GITHUB_USERNAME!,
    repo: process.env.GITHUB_REPO!,
    extraEncoding: rot13,
  });

  // await kv.set('huggingface_api_keys', JSON.stringify(['']));
  // logger.info('Value:', await kv.get('test'));
  // logger.info('Delete result:', await kv.delete('test'));
}

if (url.fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
