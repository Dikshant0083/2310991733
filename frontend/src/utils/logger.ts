export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

type LogPayload = Record<string, unknown> | undefined;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  payload?: LogPayload;
}

const severityOrder: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 10,
  [LogLevel.INFO]: 20,
  [LogLevel.WARN]: 30,
  [LogLevel.ERROR]: 40,
};

class Logger {
  private readonly minimumLevel: LogLevel;

  private readonly endpoint: string | null;

  private readonly buffer: LogEntry[] = [];

  constructor() {
    this.minimumLevel = (process.env.NEXT_PUBLIC_LOG_LEVEL as LogLevel) || LogLevel.INFO;
    this.endpoint = process.env.NEXT_PUBLIC_CLIENT_LOG_ENDPOINT || null;
  }

  private shouldLog(level: LogLevel) {
    return severityOrder[level] >= severityOrder[this.minimumLevel];
  }

  private enqueue(level: LogLevel, message: string, payload?: LogPayload) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      payload,
    };

    this.buffer.push(entry);
    if (this.buffer.length > 100) {
      this.buffer.shift();
    }

    this.flush([entry]);
  }

  private flush(entries: LogEntry[]) {
    if (!this.endpoint || typeof window === 'undefined') {
      return;
    }

    const body = JSON.stringify({ entries });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          this.endpoint,
          new Blob([body], { type: 'application/json' })
        );
        return;
      }
    } catch {
      return;
    }

    void fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }

  getBufferedLogs() {
    return [...this.buffer];
  }

  debug(message: string, payload?: LogPayload) {
    this.enqueue(LogLevel.DEBUG, message, payload);
  }

  info(message: string, payload?: LogPayload) {
    this.enqueue(LogLevel.INFO, message, payload);
  }

  warn(message: string, payload?: LogPayload) {
    this.enqueue(LogLevel.WARN, message, payload);
  }

  error(message: string, error?: unknown, payload?: LogPayload) {
    const normalizedError =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error
          ? { message: String(error) }
          : undefined;

    this.enqueue(LogLevel.ERROR, message, {
      ...payload,
      error: normalizedError,
    });
  }
}

const logger = new Logger();

export default logger;
