const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const logDir = process.env.LOG_DIR || './logs';

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
        let msg = `${timestamp} [${level}] : ${message}`;
        if (Object.keys(metadata).length > 0) {
            msg += JSON.stringify(metadata, null, 2);
        }
        return msg;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { service: 'seed-certification-api' },
    transports: [
        // Error log file
        new DailyRotateFile({
            filename: path.join(logDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'error',
            maxSize: '20m',
            maxFiles: '14d'
        }),
        // Combined log file
        new DailyRotateFile({
            filename: path.join(logDir, 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d'
        }),
        // Audit log file (for blockchain transactions)
        new DailyRotateFile({
            filename: path.join(logDir, 'audit-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            level: 'info',
            maxSize: '20m',
            maxFiles: '30d'
        })
    ]
});

// Add console transport for non-production
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: consoleFormat
    }));
}

// Audit logging helper
logger.audit = (action, userId, resourceId, details = {}) => {
    logger.info({
        type: 'AUDIT',
        action,
        userId,
        resourceId,
        details,
        timestamp: new Date().toISOString()
    });
};

// Security event logging
logger.security = (eventType, userId, details = {}) => {
    logger.warn({
        type: 'SECURITY_EVENT',
        eventType,
        userId,
        details,
        timestamp: new Date().toISOString()
    });
};

// Transaction logging
logger.transaction = (txId, status, details = {}) => {
    logger.info({
        type: 'TRANSACTION',
        txId,
        status,
        details,
        timestamp: new Date().toISOString()
    });
};

module.exports = logger;
