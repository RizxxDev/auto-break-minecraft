import { mkdirSync } from "node:fs";
import path from "node:path";
import winston from "winston";
import type { ILogger } from "../../domain/interfaces";

export class WinstonLogger implements ILogger {
  private readonly logger: winston.Logger;

  constructor(logDir: string) {
    const resolvedLogDir = path.resolve(process.cwd(), logDir);
    mkdirSync(resolvedLogDir, { recursive: true });

    this.logger = winston.createLogger({
      level: "info",
      defaultMeta: { service: "autonomous-quarry-bot" },
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.printf((info) => {
              const { timestamp, level, message, ...fields } = info;
              const suffix = Object.keys(fields).length > 1 ? ` ${JSON.stringify(fields)}` : "";
              return `${timestamp} ${level}: ${message}${suffix}`;
            })
          )
        }),
        new winston.transports.File({ filename: path.join(resolvedLogDir, "bot.log") }),
        new winston.transports.File({ filename: path.join(resolvedLogDir, "errors.log"), level: "error" })
      ]
    });
  }

  info(message: string, fields?: Record<string, unknown>): void {
    this.logger.info(message, fields);
  }

  warn(message: string, fields?: Record<string, unknown>): void {
    this.logger.warn(message, fields);
  }

  error(message: string, fields?: Record<string, unknown>): void {
    this.logger.error(message, fields);
  }

  debug(message: string, fields?: Record<string, unknown>): void {
    this.logger.debug(message, fields);
  }
}
