require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Suppress Fabric SDK discovery errors for unavailable peers
// These are logged by Fabric when it discovers peers that aren't accessible
// but doesn't affect the overall connection status
const originalConsoleError = console.error;
console.error = function (...args) {
    const msg = args.join(' ');
    // Filter out discovery-related errors for localhost peers (not accessible from Docker)
    if (msg.includes('DiscoveryResultsProcessor') ||
        msg.includes('ServiceEndpoint') && msg.includes('localhost')) {
        return; // Suppress these specific errors
    }
    originalConsoleError.apply(console, args);
};

const logger = require('./utils/logger');
const fabricService = require('./services/fabric.service');
const { initializeAuth } = require('./middleware/auth');
const { notFoundHandler, errorHandler } = require('./middleware/error');

// Routes will be imported after auth initialization

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// CORS configuration
const corsOptions = {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX) || 1000, // Increased for load testing
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Request logging
const morganFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
app.use(morgan(morganFormat, {
    stream: {
        write: (message) => logger.info(message.trim())
    }
}));

// Body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Middleware will be initialized in initializeServices()
// (Session, Keycloak, Routes will be setup after auth initialization)

// Initialize services
const cleanupService = require('./utils/cleanup');

const initializeServices = async () => {
    try {
        logger.info('[Server] Initializing services...');

        // Initialize auth middleware with Redis session store
        logger.info('[Server] Initializing authentication...');
        await initializeAuth();
        logger.info('[Server] ✓ Authentication initialized');

        // Now we can get the middleware
        const { sessionMiddleware, keycloak, logAuth } = require('./middleware/auth');

        // Session middleware for Keycloak
        app.use(sessionMiddleware);

        // Keycloak middleware
        app.use(keycloak.middleware({
            logout: '/logout',
            admin: '/'
        }));

        // Auth logging
        app.use(logAuth);

        // Import and setup routes (after auth middleware)
        const healthRoutes = require('./routes/health.routes');
        const seedBatchRoutes = require('./routes/seedBatch.routes');

        app.use('/api/health', healthRoutes);
        app.use('/api/seed-batches', seedBatchRoutes);

        // Swagger UI documentation
        const swaggerUi = require('swagger-ui-express');
        const swaggerDocument = require('../swagger.json');
        app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
            customCss: '.swagger-ui .topbar { display: none }',
            customSiteTitle: "Seed Certification API Docs"
        }));

        // Root endpoint
        app.get('/', (req, res) => {
            res.json({
                service: 'Seed Certification API Gateway',
                version: '1.0.0',
                status: 'running',
                endpoints: {
                    health: '/api/health',
                    seedBatches: '/api/seed-batches',
                    documentation: '/api-docs'
                }
            });
        });

        // 404 handler
        app.use(notFoundHandler);

        // Global error handler
        app.use(errorHandler);

        // Connect to Fabric Gateway
        logger.info('[Server] Connecting to Fabric network...');
        await fabricService.connect();
        logger.info('[Server] ✓ Fabric Gateway connected');

        // Start file cleanup cron job
        logger.info('[Server] Starting cleanup service...');
        cleanupService.start();
        logger.info('[Server] ✓ Cleanup service started');

        logger.info('[Server] All services initialized successfully');

    } catch (error) {
        logger.error('[Server] Failed to initialize services', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    logger.info(`[Server] ${signal} received, starting graceful shutdown...`);

    try {
        // Stop accepting new requests
        server.close(() => {
            logger.info('[Server] HTTP server closed');
        });

        // Stop cleanup service
        if (cleanupService) {
            cleanupService.stop();
            logger.info('[Server] Cleanup service stopped');
        }

        // Disconnect from Fabric
        await fabricService.disconnect();
        logger.info('[Server] Fabric Gateway disconnected');

        logger.info('[Server] Graceful shutdown completed');
        process.exit(0);

    } catch (error) {
        logger.error('[Server] Error during graceful shutdown', {
            error: error.message
        });
        process.exit(1);
    }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger.error('[Server] Uncaught Exception', {
        error: error.message,
        stack: error.stack
    });
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('[Server] Unhandled Rejection', {
        reason: reason,
        promise: promise
    });
});

// Start server
let server;

const startServer = async () => {
    try {
        // Initialize all services
        await initializeServices();

        // Start HTTP server
        server = app.listen(PORT, () => {
            logger.info(`[Server] ========================================`);
            logger.info(`[Server] Seed Certification API Gateway`);
            logger.info(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`[Server] Port: ${PORT}`);
            logger.info(`[Server] Health Check: http://localhost:${PORT}/api/health`);
            logger.info(`[Server] ========================================`);
        });

        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`[Server] Port ${PORT} is already in use`);
            } else {
                logger.error('[Server] Server error', { error: error.message });
            }
            process.exit(1);
        });

    } catch (error) {
        logger.error('[Server] Failed to start server', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
};

// Start the server
startServer();

module.exports = app;
