// TODO #22198
import { isNonEmptyArray } from '@sindresorhus/is';
import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import { logger } from '../../../logger';
import { exec } from '../../../util/exec';
import type { ExecOptions } from '../../../util/exec/types';
import { getGitEnvironmentVariables } from '../../../util/git/auth';
import { regEx } from '../../../util/regex';
import { sanitize } from '../../../util/sanitize';

export async function executePostInitCommands(
  config: RenovateConfig,
): Promise<void> {
  const commands = config.postInitTasks?.commands;
  const allowedCommands = GlobalConfig.get('allowedCommands');

  if (!isNonEmptyArray(commands)) {
    logger.debug('No post-init commands to execute');
    return;
  }

  logger.debug({ commands }, 'Executing post-init commands');

  for (const cmd of commands) {
    if (allowedCommands!.some((pattern) => regEx(pattern).test(cmd))) {
      try {
        logger.debug({ cmd }, 'Executing post-init command');

        const execOpts: ExecOptions = {
          cwd: GlobalConfig.get('localDir'),
          extraEnv: getGitEnvironmentVariables(),
        };

        const execResult = await exec(cmd, execOpts);

        logger.debug({ cmd, ...execResult }, 'Executed post-init command');
      } catch (error) {
        logger.warn({ cmd, err: error }, 'Post-init command failed');
        throw new Error(
          `Post-init command '${cmd}' failed: ${sanitize(error.message)}`,
        );
      }
    } else {
      const errMsg = `Post-init command '${cmd}' has not been added to the allowed list in allowedCommands`;
      logger.warn({ cmd, allowedCommands }, errMsg);
      throw new Error(errMsg);
    }
  }
}
