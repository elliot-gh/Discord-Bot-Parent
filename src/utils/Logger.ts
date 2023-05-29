import * as winston from "winston";

/**
 * Creates a logger with the given label
 * @param label The label included in log messages; probably the class name.
 * @returns A winston Logger with the given label.
 */
export function createLogger(label: string): winston.Logger {
    return parentLogger.child({
        label: label
    });
}

const loggerFormat = winston.format.printf(({ level, message, label, timestamp }) => {
    return `${timestamp} ${level}: [${label}] ${message}`;
});

const parentLogger = winston.createLogger({
    level: "debug",
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        loggerFormat
    ),
    transports: [
        new winston.transports.Console()
    ]
});
