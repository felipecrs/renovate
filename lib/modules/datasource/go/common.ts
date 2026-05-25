import { logger } from '../../../logger/index.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import { getSourceUrl as githubSourceUrl } from '../../../util/github/url.ts';
import type { Http } from '../../../util/http/index.ts';
import { regEx } from '../../../util/regex.ts';
import { joinUrlParts } from '../../../util/url.ts';
import { BitbucketTagsDatasource } from '../bitbucket-tags/index.ts';
import { ForgejoTagsDatasource } from '../forgejo-tags/index.ts';
import { GiteaTagsDatasource } from '../gitea-tags/index.ts';
import { GithubTagsDatasource } from '../github-tags/index.ts';
import { GitlabTagsDatasource } from '../gitlab-tags/index.ts';
import { getSourceUrl as gitlabSourceUrl } from '../gitlab-tags/util.ts';
import { VersionInfoSchema } from './schema.ts';

import type { DataSource, VersionInfo } from './types.ts';

/**
 * Encode uppercase letters for the GOPROXY protocol.
 *
 * @see https://golang.org/ref/mod#goproxy-protocol
 */
export function encodeGoCase(input: string): string {
  return input.replace(regEx(/([A-Z])/g), (x) => `!${x.toLowerCase()}`);
}

/**
 * Fetch the `@latest` endpoint from a Go module proxy.
 * Returns the parsed VersionInfo or null on any error.
 * Results (including failures) are cached for the duration of the run.
 */
export async function fetchLatestGoModInfo(
  http: Http,
  proxyUrl: string,
  moduleName: string,
): Promise<VersionInfo | null> {
  const cacheKey = `go-proxy-latest::${proxyUrl}::${moduleName}`;
  const cached = memCache.get<VersionInfo | null>(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const url = joinUrlParts(proxyUrl, encodeGoCase(moduleName), '@latest');
    const res = await http.getJson(url, VersionInfoSchema);
    memCache.set(cacheKey, res.body);
    return res.body;
  } catch (err) {
    logger.trace({ err }, 'Failed to get latest Go module info');
    return null;
  }
}

export function getSourceUrl(
  dataSource?: DataSource | null,
): string | undefined {
  if (dataSource) {
    const { datasource, registryUrl, packageName } = dataSource;

    switch (datasource) {
      case ForgejoTagsDatasource.id:
        return ForgejoTagsDatasource.getSourceUrl(packageName, registryUrl);
      case GiteaTagsDatasource.id:
        return GiteaTagsDatasource.getSourceUrl(packageName, registryUrl);
      case GithubTagsDatasource.id:
        return githubSourceUrl(packageName, registryUrl);
      case GitlabTagsDatasource.id:
        return gitlabSourceUrl(packageName, registryUrl);
      case BitbucketTagsDatasource.id:
        return BitbucketTagsDatasource.getSourceUrl(packageName, registryUrl);
    }
  }

  return undefined;
}
