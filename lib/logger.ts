/* eslint-disable no-console */
export const logger = {
  info: (...args: unknown[]) => console.log("[ecotrace]", ...args),
  warn: (...args: unknown[]) => console.warn("[ecotrace]", ...args),
  error: (...args: unknown[]) => console.error("[ecotrace]", ...args),
};
