import { GlobalConfig } from '../../../config/global';
import type { RenovateConfig } from '../../../config/types';
import * as _exec from '../../../util/exec';
import { executePostInitCommands } from './execute-post-init-commands';
import { partial } from '~test/util';

vi.mock('../../../util/exec');

const exec = vi.mocked(_exec);

describe('workers/repository/init/execute-post-init-commands', () => {
  beforeEach(() => {
    GlobalConfig.reset();
  });

  it('does nothing when no commands configured', async () => {
    const config = partial<RenovateConfig>({
      postInitTasks: undefined,
    });

    await executePostInitCommands(config);

    expect(exec.exec).not.toHaveBeenCalled();
  });

  it('does nothing when commands array is empty', async () => {
    const config = partial<RenovateConfig>({
      postInitTasks: {
        commands: [],
      },
    });

    await executePostInitCommands(config);

    expect(exec.exec).not.toHaveBeenCalled();
  });

  it('executes allowed commands', async () => {
    GlobalConfig.set({
      localDir: '/tmp/repo',
      allowedCommands: ['^echo'],
    });

    const config = partial<RenovateConfig>({
      postInitTasks: {
        commands: ['echo "hello"', 'echo "world"'],
      },
    });

    exec.exec.mockResolvedValue({
      stdout: '',
      stderr: '',
    });

    await executePostInitCommands(config);

    expect(exec.exec).toHaveBeenCalledTimes(2);
    expect(exec.exec).toHaveBeenCalledWith('echo "hello"', {
      cwd: '/tmp/repo',
      extraEnv: {},
    });
    expect(exec.exec).toHaveBeenCalledWith('echo "world"', {
      cwd: '/tmp/repo',
      extraEnv: {},
    });
  });

  it('throws error for disallowed commands', async () => {
    GlobalConfig.set({
      localDir: '/tmp/repo',
      allowedCommands: ['^echo'],
    });

    const config = partial<RenovateConfig>({
      postInitTasks: {
        commands: ['rm -rf /'],
      },
    });

    await expect(executePostInitCommands(config)).rejects.toThrow(
      "Post-init command 'rm -rf /' has not been added to the allowed list in allowedCommands",
    );

    expect(exec.exec).not.toHaveBeenCalled();
  });

  it('throws error when command execution fails', async () => {
    GlobalConfig.set({
      localDir: '/tmp/repo',
      allowedCommands: ['^exit'],
    });

    const config = partial<RenovateConfig>({
      postInitTasks: {
        commands: ['exit 1'],
      },
    });

    exec.exec.mockRejectedValue(new Error('Command failed'));

    await expect(executePostInitCommands(config)).rejects.toThrow(
      "Post-init command 'exit 1' failed: Command failed",
    );

    expect(exec.exec).toHaveBeenCalledTimes(1);
  });

  it('stops execution on first failure', async () => {
    GlobalConfig.set({
      localDir: '/tmp/repo',
      allowedCommands: ['^echo', '^exit'],
    });

    const config = partial<RenovateConfig>({
      postInitTasks: {
        commands: ['echo "first"', 'exit 1', 'echo "third"'],
      },
    });

    exec.exec
      .mockResolvedValueOnce({
        stdout: '',
        stderr: '',
      })
      .mockRejectedValueOnce(new Error('Command failed'));

    await expect(executePostInitCommands(config)).rejects.toThrow(
      "Post-init command 'exit 1' failed: Command failed",
    );

    expect(exec.exec).toHaveBeenCalledTimes(2);
  });
});
