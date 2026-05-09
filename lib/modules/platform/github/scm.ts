import type { PlatformCommitOptions } from '../../../config/types.ts';
import * as git from '../../../util/git/index.ts';
import type {
  CommitFilesConfig,
  LongCommitSha,
} from '../../../util/git/types.ts';
import { DefaultGitScm } from '../default-scm.ts';
import { commitFiles, isGHApp, platformConfig } from './index.ts';

export class GithubScm extends DefaultGitScm {
  override commitAndPush(
    commitConfig: CommitFilesConfig,
  ): Promise<LongCommitSha | null> {
    let platformCommit = commitConfig.platformCommit;
    if (platformCommit === 'auto' && isGHApp()) {
      platformCommit = 'enabled';
    }

    return platformCommit === 'enabled'
      ? commitFiles(commitConfig)
      : git.commitFiles(commitConfig);
  }

  override getCommitterEmailForPlatformCommit(
    platformCommit: PlatformCommitOptions,
  ): string | undefined {
    const isEnabled =
      platformCommit === 'enabled' || (platformCommit === 'auto' && isGHApp());
    return isEnabled ? platformConfig.gitCommitterEmail : undefined;
  }
}
