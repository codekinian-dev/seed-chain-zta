const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const ipfsService = require('./ipfs.service');

class TransactionService {
    constructor() {
        this.transactions = new Map(); // In-memory transaction log
        this.failedTransactions = new Map(); // Failed transactions for rollback
    }

    /**
     * Create new transaction log entry
     * @param {string} type - Transaction type
     * @param {Object} metadata - Transaction metadata
     * @returns {string} - Transaction ID
     */
    createTransaction(type, metadata = {}) {
        const txId = uuidv4();
        const transaction = {
            txId,
            type,
            status: 'PENDING',
            steps: [],
            metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.transactions.set(txId, transaction);
        logger.transaction(txId, 'CREATED', { type, metadata });

        return txId;
    }

    /**
     * Log transaction step
     * @param {string} txId - Transaction ID
     * @param {string} step - Step name
     * @param {string} status - Step status (START, SUCCESS, FAIL)
     * @param {Object} data - Step data
     */
    logStep(txId, step, status, data = {}) {
        const transaction = this.transactions.get(txId);
        if (!transaction) {
            logger.warn(`Transaction ${txId} not found`);
            return;
        }

        const stepEntry = {
            step,
            status,
            data,
            timestamp: new Date().toISOString()
        };

        transaction.steps.push(stepEntry);
        transaction.updatedAt = new Date().toISOString();

        logger.transaction(txId, `STEP_${status}`, { step, data });
    }

    /**
     * Mark transaction as successful
     * @param {string} txId - Transaction ID
     * @param {Object} result - Transaction result
     */
    success(txId, result = {}) {
        const transaction = this.transactions.get(txId);
        if (!transaction) {
            logger.warn(`Transaction ${txId} not found`);
            return;
        }

        transaction.status = 'SUCCESS';
        transaction.result = result;
        transaction.completedAt = new Date().toISOString();
        transaction.updatedAt = new Date().toISOString();

        logger.transaction(txId, 'SUCCESS', { result });
    }

    /**
     * Mark transaction as failed and prepare for rollback
     * @param {string} txId - Transaction ID
     * @param {Error} error - Error object
     */
    fail(txId, error) {
        const transaction = this.transactions.get(txId);
        if (!transaction) {
            logger.warn(`Transaction ${txId} not found`);
            return;
        }

        transaction.status = 'FAILED';
        transaction.error = {
            message: error.message,
            stack: error.stack
        };
        transaction.completedAt = new Date().toISOString();
        transaction.updatedAt = new Date().toISOString();

        // Add to failed transactions for potential rollback
        this.failedTransactions.set(txId, transaction);

        logger.transaction(txId, 'FAILED', {
            error: error.message,
            steps: transaction.steps
        });

        // Trigger rollback
        this.rollback(txId);
    }

    /**
     * Rollback failed transaction
     * @param {string} txId - Transaction ID
     */
    async rollback(txId) {
        const transaction = this.failedTransactions.get(txId);
        if (!transaction) {
            logger.warn(`Failed transaction ${txId} not found for rollback`);
            return;
        }

        logger.warn(`[Rollback] Starting rollback for transaction ${txId}`);

        const rollbackSteps = [];

        // Iterate through steps in reverse order
        for (let i = transaction.steps.length - 1; i >= 0; i--) {
            const step = transaction.steps[i];

            if (step.status === 'SUCCESS') {
                try {
                    // Rollback IPFS uploads
                    if (step.step === 'IPFS_UPLOAD' && step.data.cid) {
                        logger.info(`[Rollback] Unpinning IPFS file: ${step.data.cid}`);
                        await ipfsService.unpinFile(step.data.cid);
                        rollbackSteps.push({
                            step: step.step,
                            action: 'UNPIN_FILE',
                            cid: step.data.cid,
                            status: 'SUCCESS'
                        });
                    }

                    // Note: Blockchain transactions cannot be rolled back (immutable)
                    // We only log them for audit purposes
                    if (step.step === 'BLOCKCHAIN_SUBMIT') {
                        logger.warn(`[Rollback] Cannot rollback blockchain transaction, logged for audit`);
                        rollbackSteps.push({
                            step: step.step,
                            action: 'LOG_ONLY',
                            status: 'LOGGED'
                        });
                    }

                } catch (error) {
                    logger.error(`[Rollback] Error rolling back step ${step.step}: ${error.message}`);
                    rollbackSteps.push({
                        step: step.step,
                        status: 'FAILED',
                        error: error.message
                    });
                }
            }
        }

        transaction.rollback = {
            steps: rollbackSteps,
            completedAt: new Date().toISOString()
        };

        logger.warn(`[Rollback] Completed rollback for transaction ${txId}`, {
            rollbackSteps
        });
    }

    /**
     * Get transaction details
     * @param {string} txId - Transaction ID
     * @returns {Object|null} - Transaction details
     */
    getTransaction(txId) {
        return this.transactions.get(txId) || null;
    }

    /**
     * Get all failed transactions
     * @returns {Array} - Array of failed transactions
     */
    getFailedTransactions() {
        return Array.from(this.failedTransactions.values());
    }

    /**
     * Retry failed transaction
     * @param {string} txId - Transaction ID
     * @returns {string} - New transaction ID
     */
    retryFailedTransaction(txId) {
        const failedTx = this.failedTransactions.get(txId);
        if (!failedTx) {
            throw new Error(`Failed transaction ${txId} not found`);
        }

        logger.info(`[Retry] Retrying failed transaction ${txId}`);

        // Create new transaction with same metadata
        const newTxId = this.createTransaction(failedTx.type, {
            ...failedTx.metadata,
            retryOf: txId
        });

        return newTxId;
    }

    /**
     * Clean up old transactions (older than 24 hours)
     */
    cleanup() {
        const now = new Date().getTime();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        let cleaned = 0;

        for (const [txId, transaction] of this.transactions.entries()) {
            const createdAt = new Date(transaction.createdAt).getTime();
            if (now - createdAt > maxAge) {
                this.transactions.delete(txId);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.info(`[Cleanup] Removed ${cleaned} old transactions`);
        }
    }
}

// Singleton instance
const transactionService = new TransactionService();

// Cleanup old transactions every hour
setInterval(() => {
    transactionService.cleanup();
}, 60 * 60 * 1000);

module.exports = transactionService;
