const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const logger = require('../utils/logger');

class IPFSService {
    constructor() {
        // IPFS Cluster API URL - support both env var formats
        const ipfsHost = process.env.IPFS_HOST || 'localhost';
        const ipfsPort = process.env.IPFS_PORT || '9094';
        const ipfsProtocol = process.env.IPFS_PROTOCOL || 'http';

        this.apiUrl = process.env.IPFS_API_URL || `${ipfsProtocol}://${ipfsHost}:${ipfsPort}`;
        this.uploadTimeout = parseInt(process.env.IPFS_UPLOAD_TIMEOUT) || 120000;
        this.maxRetries = parseInt(process.env.IPFS_MAX_RETRIES) || 3;
        this.gatewayUrl = process.env.IPFS_GATEWAY_URL || 'http://localhost:8080/ipfs';

        // IPFS node API for health check (defaults to localhost:5001)
        const nodeHost = process.env.IPFS_NODE_HOST || ipfsHost;
        const nodePort = process.env.IPFS_NODE_PORT || '5001';
        this.ipfsNodeUrl = process.env.IPFS_NODE_URL || `${ipfsProtocol}://${nodeHost}:${nodePort}/api/v0`;
    }

    /**
     * Upload file to IPFS with retry mechanism
     * @param {string} filePath - Path to file to upload
     * @param {number} retryCount - Current retry attempt
     * @returns {Promise<string>} - IPFS CID
     */
    async uploadFile(filePath, retryCount = 0) {
        try {
            logger.info(`[IPFS] Uploading file: ${filePath} (attempt ${retryCount + 1}/${this.maxRetries})`);

            // Check if file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            // Create form data
            const formData = new FormData();
            formData.append('file', fs.createReadStream(filePath));

            // Upload to IPFS
            const startTime = Date.now();
            const response = await axios.post(`${this.apiUrl}/add`, formData, {
                headers: formData.getHeaders(),
                timeout: this.uploadTimeout,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });

            const duration = Date.now() - startTime;

            // Extract CID from response
            const cid = response.data.Hash || response.data.cid;

            if (!cid) {
                throw new Error('No CID returned from IPFS');
            }

            logger.info(`[IPFS] Upload successful: ${cid} (${duration}ms)`);

            return cid;

        } catch (error) {
            logger.error(`[IPFS] Upload failed (attempt ${retryCount + 1}): ${error.message}`);

            // Retry logic with exponential backoff
            if (retryCount < this.maxRetries - 1) {
                const backoffTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
                logger.info(`[IPFS] Retrying in ${backoffTime}ms...`);

                await new Promise(resolve => setTimeout(resolve, backoffTime));
                return this.uploadFile(filePath, retryCount + 1);
            }

            // Max retries exceeded
            throw new Error(`IPFS upload failed after ${this.maxRetries} attempts: ${error.message}`);
        }
    }

    /**
     * Get file from IPFS
     * @param {string} cid - IPFS CID
     * @returns {Promise<Buffer>} - File content
     */
    async getFile(cid) {
        try {
            logger.info(`[IPFS] Retrieving file: ${cid}`);

            const response = await axios.get(`${this.gatewayUrl}/${cid}`, {
                responseType: 'arraybuffer',
                timeout: 30000
            });

            logger.info(`[IPFS] File retrieved successfully: ${cid}`);
            return response.data;

        } catch (error) {
            logger.error(`[IPFS] Failed to retrieve file ${cid}: ${error.message}`);
            throw new Error(`Failed to retrieve file from IPFS: ${error.message}`);
        }
    }

    /**
     * Validate CID format
     * @param {string} cid - IPFS CID to validate
     * @returns {boolean}
     */
    validateCID(cid) {
        // Basic CID validation (v0 or v1)
        const cidRegex = /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[A-Za-z2-7]{58}|B[A-Z2-7]{58}|z[1-9A-HJ-NP-Za-km-z]{48}|F[0-9A-F]{50})$/;
        return cidRegex.test(cid);
    }

    /**
     * Pin file to ensure persistence
     * @param {string} cid - IPFS CID
     * @returns {Promise<boolean>}
     */
    async pinFile(cid) {
        try {
            logger.info(`[IPFS] Pinning file: ${cid}`);

            const response = await axios.post(`${this.apiUrl}/pin/add`, null, {
                params: { arg: cid },
                timeout: 30000
            });

            logger.info(`[IPFS] File pinned successfully: ${cid}`);
            return true;

        } catch (error) {
            logger.error(`[IPFS] Failed to pin file ${cid}: ${error.message}`);
            return false;
        }
    }

    /**
     * Unpin file (for rollback scenarios)
     * @param {string} cid - IPFS CID
     * @returns {Promise<boolean>}
     */
    async unpinFile(cid) {
        try {
            logger.info(`[IPFS] Unpinning file: ${cid}`);

            await axios.post(`${this.apiUrl}/pin/rm`, null, {
                params: { arg: cid },
                timeout: 30000
            });

            logger.info(`[IPFS] File unpinned successfully: ${cid}`);
            return true;

        } catch (error) {
            logger.error(`[IPFS] Failed to unpin file ${cid}: ${error.message}`);
            return false;
        }
    }

    /**
     * Check if IPFS service is available
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            // Check IPFS node (not cluster) for version
            const response = await axios.post(`${this.ipfsNodeUrl}/version`, null, {
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            logger.error(`[IPFS] Service not available: ${error.message}`);
            return false;
        }
    }
}

// Singleton instance
const ipfsService = new IPFSService();

module.exports = ipfsService;
