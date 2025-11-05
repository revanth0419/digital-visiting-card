/**
 * Environment-aware logging utility
 * Only logs to console in development mode to prevent information leakage in production
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  /**
   * Log error messages - only visible in development
   * @param message - Error message to log
   * @param error - Optional error object or additional context
   */
  error: (message: string, error?: unknown) => {
    if (isDevelopment) {
      console.error(message, error);
    }
    // In production: Could integrate with monitoring service here
  },

  /**
   * Log warning messages - only visible in development
   * @param message - Warning message to log
   * @param data - Optional additional context
   */
  warn: (message: string, data?: unknown) => {
    if (isDevelopment) {
      console.warn(message, data);
    }
  },

  /**
   * Log info messages - only visible in development
   * @param message - Info message to log
   * @param data - Optional additional context
   */
  info: (message: string, data?: unknown) => {
    if (isDevelopment) {
      console.log(message, data);
    }
  },
};
