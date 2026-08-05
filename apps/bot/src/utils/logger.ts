import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const customFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
    // Additional info passed as extra metadata parameters
    const metaString = Object.keys(meta).length
        ? ` ${JSON.stringify(meta)}`
        : '';
    const stackString = stack ? `\n${stack}` : '';
    return `[${timestamp}] ${level}: ${message}${metaString}${stackString}`;
});

export const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        colorize(),
        customFormat
    ),
    transports: [new winston.transports.Console()],
});


