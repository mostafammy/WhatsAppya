export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
}

export const silentLogger: Logger = { debug: () => {}, warn: () => {} };
