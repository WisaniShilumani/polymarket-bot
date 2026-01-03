import chalk from 'chalk';

/**
 * Colored logging utility for the Polymarket bot
 * Provides consistent color-coded logging throughout the application
 */

export const logger = {
  // Success messages (green)
  success: (...args: any[]) => {
    console.log(chalk.green(...args));
  },

  // Error messages (red)
  error: (...args: any[]) => {
    console.error(chalk.red(...args));
  },

  // Warning messages (yellow)
  warn: (...args: any[]) => {
    console.log(chalk.yellow(...args));
  },

  // Info messages (cyan)
  info: (...args: any[]) => {
    console.log(chalk.cyan(...args));
  },

  // Debug/data messages (gray)
  debug: (...args: any[]) => {
    console.log(chalk.gray(...args));
  },

  // Headers/titles (magenta bold)
  header: (...args: any[]) => {
    console.log(chalk.magenta.bold(...args));
  },

  // Highlighted/important data (bright white bold)
  highlight: (...args: any[]) => {
    console.log(chalk.white.bold(...args));
  },

  // Financial data (green bold)
  money: (...args: any[]) => {
    console.log(chalk.green.bold(...args));
  },

  // Progress/status (blue)
  progress: (...args: any[]) => {
    console.log(chalk.blue(...args));
  },

  // Regular log with no color (for compatibility)
  log: (...args: any[]) => {
    console.log(...args);
  }
};

// Export individual functions for convenience
export const { success, error, warn, info, debug, header, highlight, money, progress, log } = logger;

export default logger;
