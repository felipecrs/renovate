import type { z } from 'zod/v3';
import type { VersionInfoSchema } from './schema.ts';

export type GoproxyFallback =
  | ',' // WhenNotFoundOrGone
  | '|'; // Always

export interface DataSource {
  datasource: string;
  registryUrl?: string;
  packageName: string;
}

export type VersionInfo = z.infer<typeof VersionInfoSchema>;

export interface GoproxyItem {
  url: string;
  fallback: GoproxyFallback;
}
