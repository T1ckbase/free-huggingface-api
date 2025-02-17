import winston from 'winston';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.errors({ stack: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level}] ${message}`)
  ),
  transports: [new winston.transports.Console()],
});
