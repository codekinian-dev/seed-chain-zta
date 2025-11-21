const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

const uploadDir = process.env.UPLOAD_DIR || './uploads';
const cleanupAgeHours = 1; // Auto-cleanup after 1 hour

class FileCleanup {
    constructor() {
        this.isRunning = false;
    }

    /**
     * Start cron job to cleanup old temporary files
     * Runs every 30 minutes
     */
    start() {
        if (this.isRunning) {
            logger.warn('File cleanup cron job is already running');
            return;
        }

        // Run every 30 minutes
        this.job = cron.schedule('*/30 * * * *', async () => {
            await this.cleanupOldFiles();
        });

        this.isRunning = true;
        logger.info('File cleanup cron job started');

        // Run immediately on start
        this.cleanupOldFiles();
    }

    /**
     * Stop cron job
     */
    stop() {
        if (this.job) {
            this.job.stop();
            this.isRunning = false;
            logger.info('File cleanup cron job stopped');
        }
    }

    /**
     * Clean up files older than specified hours
     */
    async cleanupOldFiles() {
        try {
            logger.info('Starting cleanup of old temporary files...');

            // Check if upload directory exists
            try {
                await fs.access(uploadDir);
            } catch (error) {
                logger.warn(`Upload directory ${uploadDir} does not exist, skipping cleanup`);
                return;
            }

            const files = await fs.readdir(uploadDir);
            const now = Date.now();
            const maxAge = cleanupAgeHours * 60 * 60 * 1000; // Convert hours to milliseconds

            let deletedCount = 0;
            let totalSize = 0;

            for (const file of files) {
                const filePath = path.join(uploadDir, file);

                try {
                    const stats = await fs.stat(filePath);

                    // Check if file is older than max age
                    const fileAge = now - stats.mtimeMs;

                    if (fileAge > maxAge) {
                        const fileSize = stats.size;
                        await fs.unlink(filePath);
                        deletedCount++;
                        totalSize += fileSize;

                        logger.info(`Deleted old file: ${file} (age: ${Math.round(fileAge / 1000 / 60)} minutes)`);
                    }
                } catch (error) {
                    logger.error(`Error processing file ${file}: ${error.message}`);
                }
            }

            if (deletedCount > 0) {
                logger.info(`Cleanup completed: ${deletedCount} files deleted (${(totalSize / 1024 / 1024).toFixed(2)} MB freed)`);
            } else {
                logger.info('Cleanup completed: No files to delete');
            }

        } catch (error) {
            logger.error(`Error during file cleanup: ${error.message}`, { error });
        }
    }

    /**
     * Manually cleanup a specific file
     */
    async cleanupFile(filePath) {
        try {
            await fs.unlink(filePath);
            logger.info(`Manually cleaned up file: ${filePath}`);
            return true;
        } catch (error) {
            logger.error(`Error cleaning up file ${filePath}: ${error.message}`);
            return false;
        }
    }
}

// Singleton instance
const fileCleanup = new FileCleanup();

module.exports = fileCleanup;
