import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodemonEntrypoint = path.join(projectRoot, 'node_modules', 'nodemon', 'bin', 'nodemon.js');
const port = Number.parseInt(process.env.PORT, 10) || 5000;

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const parseNetstatOutput = (stdout) =>
  stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes('LISTENING'))
    .map((line) => {
      const parts = line.split(/\s+/);
      const pid = Number.parseInt(parts.at(-1), 10);
      return Number.isFinite(pid) ? pid : null;
    })
    .filter((pid, index, array) => Number.isFinite(pid) && array.indexOf(pid) === index);

const getListeningPids = async (targetPort) => {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync(
        'cmd.exe',
        ['/c', `netstat -ano | findstr :${targetPort}`],
        {
          cwd: projectRoot,
          windowsHide: true,
        }
      );

      return parseNetstatOutput(stdout);
    } catch (error) {
      const message = error?.stdout || error?.message || '';
      if (/no matches found/i.test(message) || !message.trim()) {
        return [];
      }

      throw error;
    }
  }

  try {
    const { stdout } = await execFileAsync('lsof', ['-ti', `tcp:${targetPort}`], {
      cwd: projectRoot,
    });

    return stdout
      .split(/\r?\n/)
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter((value, index, array) => Number.isFinite(value) && array.indexOf(value) === index);
  } catch {
    return [];
  }
};

const terminatePid = async (pid) => {
  if (pid === process.pid) {
    return;
  }

  if (process.platform === 'win32') {
    await execFileAsync('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      cwd: projectRoot,
      windowsHide: true,
    });
    return;
  }

  process.kill(pid, 'SIGTERM');
};

const waitForPortToFree = async (targetPort) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const remainingPids = await getListeningPids(targetPort);
    if (remainingPids.length === 0) {
      return true;
    }

    await delay(250);
  }

  return false;
};

const freePortIfNeeded = async (targetPort) => {
  const listeningPids = await getListeningPids(targetPort);
  if (listeningPids.length === 0) {
    return;
  }

  process.stdout.write(
    `[dev-helper] Port ${targetPort} is busy. Reclaiming PID(s): ${listeningPids.join(', ')}\n`
  );

  for (const pid of listeningPids) {
    try {
      await terminatePid(pid);
    } catch (error) {
      process.stderr.write(
        `[dev-helper] Failed to terminate PID ${pid}: ${error instanceof Error ? error.message : String(error)}\n`
      );
    }
  }

  const isFree = await waitForPortToFree(targetPort);
  if (!isFree) {
    throw new Error(`Port ${targetPort} is still in use after attempting cleanup.`);
  }
};

const run = async () => {
  await freePortIfNeeded(port);

  const child = spawn(process.execPath, [nodemonEntrypoint, 'src/index.js'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
};

run().catch((error) => {
  process.stderr.write(
    `[dev-helper] Unable to start backend dev server: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
