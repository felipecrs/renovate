import * as memCache from '../../cache/memory';
import type { HttpResponse } from '../types';
import { AbstractHttpCacheProvider } from './abstract-http-cache-provider';
import type { HttpCache } from './schema';

export class MemoryHttpCacheProvider extends AbstractHttpCacheProvider {
  private cacheKey(url: string): string {
    return `memory-cache-http-provider:${url}`;
  }

  protected override load(url: string): Promise<unknown> {
    const data = memCache.get<HttpCache>(this.cacheKey(url));
    if (typeof data?.httpResponse === 'string') {
      const parsedData = {
        ...data,
        httpResponse: JSON.parse(data.httpResponse),
      };
      return Promise.resolve(parsedData);
    }
    return Promise.resolve(data);
  }

  protected override persist(url: string, data: HttpCache): Promise<void> {
    const dataToSave = {
      ...data,
      httpResponse: JSON.stringify(data?.httpResponse),
    };
    memCache.set(this.cacheKey(url), dataToSave);
    return Promise.resolve();
  }

  override async bypassServer<T>(url: string): Promise<HttpResponse<T> | null> {
    const cached = await this.get(url);
    if (!cached) {
      return null;
    }

    return cached.httpResponse as HttpResponse<T>;
  }
}

export const memCacheProvider = new MemoryHttpCacheProvider();
