const express = require('express');
const router = express.Router();
const fabricService = require('../services/fabric.service');
const ipfsService = require('../services/ipfs.service');
const queueService = require('../services/queue.service');
const logger = require('../utils/logger');

/**
 * @route   GET /api/health
 * @desc    Health check endpoint - checks all services
 * @access  Public
 */
router.get('/', async (req, res) => {
    try {
        const startTime = Date.now();

        // Check all services in parallel
        const [fabricStatus, ipfsStatus, queueStatus] = await Promise.allSettled([
            fabricService.isAvailable(),
            ipfsService.isAvailable(),
            queueService.isAvailable()
        ]);

        const fabricHealthy = fabricStatus.status === 'fulfilled' && fabricStatus.value;
        const ipfsHealthy = ipfsStatus.status === 'fulfilled' && ipfsStatus.value;
        const queueHealthy = queueStatus.status === 'fulfilled' && queueStatus.value;

        // Get queue statistics if available
        let queueStats = null;
        if (queueHealthy) {
            try {
                queueStats = await queueService.getQueueStats();
            } catch (error) {
                logger.error('[Health] Error getting queue stats', { error: error.message });
            }
        }

        const allHealthy = fabricHealthy && ipfsHealthy && queueHealthy;
        const responseTime = Date.now() - startTime;

        const healthStatus = {
            status: allHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            responseTime: `${responseTime}ms`,
            services: {
                blockchain: {
                    status: fabricHealthy ? 'up' : 'down',
                    message: fabricHealthy ? 'Connected to Fabric network' : 'Unable to connect to Fabric network'
                },
                ipfs: {
                    status: ipfsHealthy ? 'up' : 'down',
                    message: ipfsHealthy ? 'Connected to IPFS cluster' : 'Unable to connect to IPFS cluster'
                },
                queue: {
                    status: queueHealthy ? 'up' : 'down',
                    message: queueHealthy ? 'Redis queue operational' : 'Unable to connect to Redis',
                    stats: queueStats
                }
            },
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        };

        logger.info('[Health] Health check performed', {
            status: healthStatus.status,
            responseTime,
            fabricHealthy,
            ipfsHealthy,
            queueHealthy
        });

        // Return 200 if all healthy, 503 if degraded
        const statusCode = allHealthy ? 200 : 503;
        res.status(statusCode).json(healthStatus);

    } catch (error) {
        logger.error('[Health] Health check failed', {
            error: error.message
        });

        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * @route   GET /api/health/fabric
 * @desc    Check Fabric network connectivity
 * @access  Public
 */
router.get('/fabric', async (req, res) => {
    try {
        const isAvailable = await fabricService.isAvailable();

        res.status(isAvailable ? 200 : 503).json({
            service: 'blockchain',
            status: isAvailable ? 'up' : 'down',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            service: 'blockchain',
            status: 'down',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route   GET /api/health/ipfs
 * @desc    Check IPFS cluster connectivity
 * @access  Public
 */
router.get('/ipfs', async (req, res) => {
    try {
        const isAvailable = await ipfsService.isAvailable();

        res.status(isAvailable ? 200 : 503).json({
            service: 'ipfs',
            status: isAvailable ? 'up' : 'down',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            service: 'ipfs',
            status: 'down',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route   GET /api/health/queue
 * @desc    Check Redis queue connectivity and stats
 * @access  Public
 */
router.get('/queue', async (req, res) => {
    try {
        const isAvailable = await queueService.isAvailable();
        let stats = null;

        if (isAvailable) {
            stats = await queueService.getQueueStats();
        }

        res.status(isAvailable ? 200 : 503).json({
            service: 'queue',
            status: isAvailable ? 'up' : 'down',
            stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            service: 'queue',
            status: 'down',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route   GET /api/health/readiness
 * @desc    Kubernetes readiness probe
 * @access  Public
 */
router.get('/readiness', async (req, res) => {
    try {
        const fabricReady = await fabricService.isAvailable();

        if (fabricReady) {
            res.status(200).json({ ready: true });
        } else {
            res.status(503).json({ ready: false });
        }
    } catch (error) {
        res.status(503).json({ ready: false, error: error.message });
    }
});

/**
 * @route   GET /api/health/liveness
 * @desc    Kubernetes liveness probe
 * @access  Public
 */
router.get('/liveness', (req, res) => {
    res.status(200).json({ alive: true });
});

module.exports = router;
