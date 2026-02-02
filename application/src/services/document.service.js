/**
 * Document Service
 * Handles document operations including hashing, IPFS integration, and verification
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const ipfsService = require('./ipfs.service');

class DocumentService {
    /**
     * Calculate SHA256 hash of a file
     * @param {string} filePath - Path to the file
     * @returns {Promise<string>} - Hex-encoded SHA256 hash
     */
    async calculateFileHash(filePath) {
        return new Promise((resolve, reject) => {
            try {
                const hash = crypto.createHash('sha256');
                const stream = fs.createReadStream(filePath);

                stream.on('data', (data) => {
                    hash.update(data);
                });

                stream.on('end', () => {
                    const hashHex = hash.digest('hex');
                    logger.info(`[Document] SHA256 hash calculated: ${hashHex.substring(0, 16)}...`);
                    resolve(hashHex);
                });

                stream.on('error', (error) => {
                    logger.error(`[Document] Error calculating hash: ${error.message}`);
                    reject(error);
                });
            } catch (error) {
                logger.error(`[Document] Error calculating hash: ${error.message}`);
                reject(error);
            }
        });
    }

    /**
     * Calculate SHA256 hash of a buffer
     * @param {Buffer} buffer - File buffer
     * @returns {string} - Hex-encoded SHA256 hash
     */
    calculateBufferHash(buffer) {
        const hash = crypto.createHash('sha256');
        hash.update(buffer);
        return hash.digest('hex');
    }

    /**
     * Upload file to IPFS with SHA256 hash
     * @param {string} filePath - Path to the file
     * @returns {Promise<Object>} - { cid, sha256Hash }
     */
    async uploadWithHash(filePath) {
        try {
            logger.info(`[Document] Uploading file with hash: ${filePath}`);

            // Calculate hash before upload
            const sha256Hash = await this.calculateFileHash(filePath);

            // Upload to IPFS
            const cid = await ipfsService.uploadFile(filePath);

            logger.info(`[Document] File uploaded successfully`, {
                cid,
                sha256Hash: sha256Hash.substring(0, 16) + '...'
            });

            return {
                cid,
                sha256Hash
            };
        } catch (error) {
            logger.error(`[Document] Error uploading file with hash: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get file from IPFS via gateway
     * @param {string} cid - IPFS CID
     * @returns {Promise<Buffer>} - File content as buffer
     */
    async getFile(cid) {
        try {
            // Validate CID format
            if (!ipfsService.validateCID(cid)) {
                throw new Error(`Invalid IPFS CID format: ${cid}`);
            }

            logger.info(`[Document] Retrieving file from IPFS: ${cid}`);
            const fileBuffer = await ipfsService.getFile(cid);

            return fileBuffer;
        } catch (error) {
            logger.error(`[Document] Error retrieving file: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get file stream from IPFS (for streaming large files)
     * @param {string} cid - IPFS CID
     * @returns {Promise<Object>} - { stream, contentType, contentLength }
     */
    async getFileStream(cid) {
        try {
            // Validate CID format
            if (!ipfsService.validateCID(cid)) {
                throw new Error(`Invalid IPFS CID format: ${cid}`);
            }

            logger.info(`[Document] Streaming file from IPFS: ${cid}`);

            const axios = require('axios');
            const response = await axios({
                method: 'get',
                url: `${ipfsService.gatewayUrl}/${cid}`,
                responseType: 'stream',
                timeout: 60000
            });

            return {
                stream: response.data,
                contentType: response.headers['content-type'] || 'application/octet-stream',
                contentLength: response.headers['content-length']
            };
        } catch (error) {
            logger.error(`[Document] Error streaming file: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verify document integrity by comparing SHA256 hashes
     * @param {string} cid - IPFS CID
     * @param {string} expectedHash - Expected SHA256 hash
     * @returns {Promise<Object>} - Verification result
     */
    async verifyDocumentIntegrity(cid, expectedHash) {
        try {
            logger.info(`[Document] Verifying document integrity for CID: ${cid}`);

            // Validate CID format
            if (!ipfsService.validateCID(cid)) {
                return {
                    valid: false,
                    error: 'Invalid IPFS CID format',
                    cid,
                    expectedHash
                };
            }

            // Validate hash format (64 hex characters for SHA256)
            if (!this.isValidSHA256Hash(expectedHash)) {
                return {
                    valid: false,
                    error: 'Invalid SHA256 hash format',
                    cid,
                    expectedHash
                };
            }

            // Get file from IPFS
            const fileBuffer = await this.getFile(cid);

            // Calculate actual hash
            const actualHash = this.calculateBufferHash(fileBuffer);

            // Compare hashes
            const isValid = actualHash.toLowerCase() === expectedHash.toLowerCase();

            const result = {
                valid: isValid,
                cid,
                expectedHash: expectedHash.toLowerCase(),
                actualHash: actualHash.toLowerCase(),
                fileSize: fileBuffer.length,
                verifiedAt: new Date().toISOString()
            };

            if (!isValid) {
                result.error = 'Hash mismatch - document may have been tampered with';
                logger.warn(`[Document] Hash mismatch detected for CID: ${cid}`);
            } else {
                logger.info(`[Document] Document integrity verified for CID: ${cid}`);
            }

            return result;
        } catch (error) {
            logger.error(`[Document] Error verifying document: ${error.message}`);
            return {
                valid: false,
                error: `Verification failed: ${error.message}`,
                cid,
                expectedHash
            };
        }
    }

    /**
     * Validate SHA256 hash format
     * @param {string} hash - Hash string to validate
     * @returns {boolean}
     */
    isValidSHA256Hash(hash) {
        if (!hash || typeof hash !== 'string') return false;
        return /^[a-fA-F0-9]{64}$/.test(hash);
    }

    /**
     * Get file metadata from IPFS
     * @param {string} cid - IPFS CID
     * @returns {Promise<Object>}
     */
    async getFileMetadata(cid) {
        try {
            if (!ipfsService.validateCID(cid)) {
                throw new Error(`Invalid IPFS CID format: ${cid}`);
            }

            const fileBuffer = await this.getFile(cid);
            const hash = this.calculateBufferHash(fileBuffer);

            return {
                cid,
                size: fileBuffer.length,
                sha256Hash: hash
            };
        } catch (error) {
            logger.error(`[Document] Error getting file metadata: ${error.message}`);
            throw error;
        }
    }
}

// Singleton instance
const documentService = new DocumentService();

module.exports = documentService;
