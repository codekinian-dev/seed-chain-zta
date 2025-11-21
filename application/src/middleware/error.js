const logger = require('../utils/logger');
const { cleanupFile } = require('./upload');

/**
 * Custom error class for application errors
 */
class AppError extends Error {
    constructor(message, statusCode = 500, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Handle 404 Not Found
 */
const notFoundHandler = (req, res, next) => {
    const error = new AppError(`Route not found: ${req.originalUrl}`, 404);
    next(error);
};

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    error.statusCode = err.statusCode || 500;

    // Log error
    logger.error('[Error Handler] Request error', {
        error: error.message,
        statusCode: error.statusCode,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        stack: err.stack
    });

    // Cleanup uploaded file if exists
    if (req.file) {
        cleanupFile(req.file.path);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = 'Validation Error';
        const details = Object.values(err.errors).map(e => e.message);
        error = new AppError(message, 400, details);
    }

    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `Duplicate value for field: ${field}`;
        error = new AppError(message, 400);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token';
        error = new AppError(message, 401);
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired';
        error = new AppError(message, 401);
    }

    // Fabric errors
    if (err.message && err.message.includes('chaincode')) {
        logger.error('[Error Handler] Chaincode error', {
            error: err.message,
            userId: req.user?.id
        });
        error = new AppError('Blockchain operation failed', 500, err.message);
    }

    // IPFS errors
    if (err.message && err.message.toLowerCase().includes('ipfs')) {
        logger.error('[Error Handler] IPFS error', {
            error: err.message,
            userId: req.user?.id
        });
        error = new AppError('File storage operation failed', 500, err.message);
    }

    // Send error response
    const response = {
        error: error.isOperational ? error.message : 'Internal Server Error',
        statusCode: error.statusCode
    };

    // Include details in development mode or for operational errors
    if (process.env.NODE_ENV === 'development' || error.isOperational) {
        if (error.details) {
            response.details = error.details;
        }
        if (process.env.NODE_ENV === 'development') {
            response.stack = err.stack;
        }
    }

    res.status(error.statusCode).json(response);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    AppError,
    notFoundHandler,
    errorHandler,
    asyncHandler
};
