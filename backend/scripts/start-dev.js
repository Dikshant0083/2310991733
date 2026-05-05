import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import dotenv from 'dotenv';

const explicitPort = process.env.PORT;
dotenv.config({ override: true });
if (explicitPort) {
  process.env.PORT = explicitPort;
}

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodemonEntrypoint = path.join(projectRoot, 'node_modules', 'nodemon', 'bin', 'nodemon.js');
const port = Number.parseInt(process.env.PORT, 10) || 5000;

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const isPortAvailable = (targetPort) =>
  new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error?.code === 'EADDRINUSE') {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.once('listening', () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(true);
      });
    });

    server.listen(targetPort);
  });

const parseNetstatOutput = (stdout, targetPort) =>
  stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes('LISTENING'))
    .filter((line) => {
      const parts = line.split(/\s+/);
      const localAddress = parts[1] || '';
      return localAddress.endsWith(`:${targetPort}`);
    })
    .map((line) => {
      const parts = line.split(/\s+/);
      const pid = Number.parseInt(parts.at(-1), 10);
      return Number.isFinite(pid) ? pid : null;
    })
    .filter((pid, index, array) => Number.isFinite(pid) && array.indexOf(pid) === index);

const getListeningPids = async (targetPort) => {
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('netstat.exe', ['-ano'], {
      cwd: projectRoot,
      windowsHide: true,
    });

    return parseNetstatOutput(stdout, targetPort);
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
    const available = await isPortAvailable(targetPort);
    if (available) {
      return true;
    }

    await delay(250);
  }

  return false;
};

const freePortIfNeeded = async (targetPort) => {
  const available = await isPortAvailable(targetPort);
  if (available) {
    return;
  }

  let listeningPids = [];

  try {
    listeningPids = await getListeningPids(targetPort);
  } catch (error) {
    throw new Error(
      `Port ${targetPort} is already in use and the dev helper could not inspect the owning process. Stop the existing process manually or start the backend with a different PORT.`
    );
  }

  if (listeningPids.length === 0) {
    throw new Error(
      `Port ${targetPort} is already in use. Stop the existing process manually or start the backend with a different PORT.`
    );
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

const getDevRuntime = () => {
  if (process.platform === 'win32') {
    return {
      command: process.execPath,
      args: ['src/index.js'],
      label: 'node',
    };
  }

  return {
    command: process.execPath,
    args: [nodemonEntrypoint, 'src/index.js'],
    label: 'nodemon',
  };
};

const run = async () => {
  await freePortIfNeeded(port);

  const runtime = getDevRuntime();
  const child = spawn(runtime.command, runtime.args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });

  child.on('error', (error) => {
    process.stderr.write(
      `[dev-helper] Failed to launch ${runtime.label}: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
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
