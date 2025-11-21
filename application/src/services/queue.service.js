const Queue = require('bull');
const logger = require('../utils/logger');
const ipfsService = require('./ipfs.service');

class QueueService {
    constructor() {
        this.redisConfig = {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT) || 6379
        };

        this.queueName = process.env.QUEUE_NAME || 'ipfs-upload-queue';

        // Create Bull queue
        this.uploadQueue = new Queue(this.queueName, {
            redis: this.redisConfig,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                },
                removeOnComplete: true,
                removeOnFail: false
            }
        });

        this.setupEventHandlers();
    }

    /**
     * Setup queue event handlers
     */
    setupEventHandlers() {
        // Job completed
        this.uploadQueue.on('completed', (job, result) => {
            logger.info(`[Queue] Job ${job.id} completed`, {
                jobId: job.id,
                cid: result.cid,
                duration: result.duration
            });
        });

        // Job failed
        this.uploadQueue.on('failed', (job, error) => {
            logger.error(`[Queue] Job ${job.id} failed`, {
                jobId: job.id,
                error: error.message,
                attempts: job.attemptsMade
            });
        });

        // Job active
        this.uploadQueue.on('active', (job) => {
            logger.info(`[Queue] Job ${job.id} started processing`, {
                jobId: job.id,
                filePath: job.data.filePath
            });
        });

        // Queue error
        this.uploadQueue.on('error', (error) => {
            logger.error(`[Queue] Queue error: ${error.message}`);
        });

        // Process jobs
        this.uploadQueue.process(async (job) => {
            return await this.processUpload(job);
        });
    }

    /**
     * Add upload job to queue
     * @param {string} filePath - Path to file
     * @param {Object} metadata - Additional metadata
     * @returns {Promise<Object>} - Job object
     */
    async addUploadJob(filePath, metadata = {}) {
        try {
            const job = await this.uploadQueue.add({
                filePath,
                metadata,
                timestamp: new Date().toISOString()
            }, {
                priority: metadata.priority || 5,
                timeout: 180000 // 3 minutes
            });

            logger.info(`[Queue] Upload job added: ${job.id}`, {
                filePath,
                jobId: job.id
            });

            return job;

        } catch (error) {
            logger.error(`[Queue] Failed to add job: ${error.message}`);
            throw error;
        }
    }

    /**
     * Process upload job
     * @param {Object} job - Bull job object
     * @returns {Promise<Object>} - Upload result
     */
    async processUpload(job) {
        const { filePath, metadata } = job.data;
        const startTime = Date.now();

        try {
            logger.info(`[Queue] Processing upload for: ${filePath}`);

            // Upload to IPFS
            const cid = await ipfsService.uploadFile(filePath);

            // Pin file for persistence
            await ipfsService.pinFile(cid);

            const duration = Date.now() - startTime;

            return {
                cid,
                filePath,
                duration,
                metadata
            };

        } catch (error) {
            logger.error(`[Queue] Upload processing failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get job status
     * @param {string} jobId - Job ID
     * @returns {Promise<Object>} - Job status
     */
    async getJobStatus(jobId) {
        try {
            const job = await this.uploadQueue.getJob(jobId);

            if (!job) {
                return { status: 'NOT_FOUND' };
            }

            const state = await job.getState();
            const progress = job.progress();

            return {
                jobId: job.id,
                status: state,
                progress,
                data: job.data,
                returnvalue: job.returnvalue,
                failedReason: job.failedReason,
                attemptsMade: job.attemptsMade
            };

        } catch (error) {
            logger.error(`[Queue] Failed to get job status: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get queue statistics
     * @returns {Promise<Object>} - Queue stats
     */
    async getQueueStats() {
        try {
            const [waiting, active, completed, failed, delayed] = await Promise.all([
                this.uploadQueue.getWaitingCount(),
                this.uploadQueue.getActiveCount(),
                this.uploadQueue.getCompletedCount(),
                this.uploadQueue.getFailedCount(),
                this.uploadQueue.getDelayedCount()
            ]);

            return {
                waiting,
                active,
                completed,
                failed,
                delayed,
                total: waiting + active + completed + failed + delayed
            };

        } catch (error) {
            logger.error(`[Queue] Failed to get queue stats: ${error.message}`);
            throw error;
        }
    }

    /**
     * Clean old jobs from queue
     * @param {number} grace - Grace period in milliseconds
     */
    async cleanQueue(grace = 24 * 60 * 60 * 1000) {
        try {
            await this.uploadQueue.clean(grace, 'completed');
            await this.uploadQueue.clean(grace, 'failed');
            logger.info(`[Queue] Cleaned old jobs (grace: ${grace}ms)`);
        } catch (error) {
            logger.error(`[Queue] Failed to clean queue: ${error.message}`);
        }
    }

    /**
     * Close queue connection
     */
    async close() {
        try {
            await this.uploadQueue.close();
            logger.info('[Queue] Queue connection closed');
        } catch (error) {
            logger.error(`[Queue] Error closing queue: ${error.message}`);
        }
    }

    /**
     * Check if Redis is available
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            const client = this.uploadQueue.client;
            await client.ping();
            return true;
        } catch (error) {
            logger.error(`[Queue] Redis not available: ${error.message}`);
            return false;
        }
    }
}

// Singleton instance
const queueService = new QueueService();

module.exports = queueService;
