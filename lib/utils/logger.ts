/**
 * Logger Utility
 * Centralized logging for the application
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === "development";

  private formatLog(entry: LogEntry): string {
    return `[${entry.timestamp}] [${entry.level}] [${entry.context}] ${entry.message}`;
  }

  private log(level: LogLevel, context: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
      data,
    };

    const formatted = this.formatLog(entry);

    switch (level) {
      case LogLevel.DEBUG:
        // Debug logging disabled in production
        break;
      case LogLevel.INFO:
        console.log(formatted, data);
        break;
      case LogLevel.WARN:
        console.warn(formatted, data);
        break;
      case LogLevel.ERROR:
        console.error(formatted, data);
        break;
    }
  }

  debug(context: string, message: string, data?: any) {
    this.log(LogLevel.DEBUG, context, message, data);
  }

  info(context: string, message: string, data?: any) {
    this.log(LogLevel.INFO, context, message, data);
  }

  warn(context: string, message: string, data?: any) {
    this.log(LogLevel.WARN, context, message, data);
  }

  error(context: string, message: string, data?: any) {
    this.log(LogLevel.ERROR, context, message, data);
  }
}

export const logger = new Logger();

