/**
 * Document Service
 * Handles document retrieval and verification via API
 */

import httpClient from '../http-client'

const documentService = {
    /**
     * Get document URL via API gateway
     * @param {string} cid - IPFS CID
     * @returns {string} - API URL for document
     */
    getDocumentUrl(cid) {
        if (!cid) return ''
        const baseUrl = httpClient.getBaseUrl()
        return `${baseUrl}/api/v1/documents/${cid}`
    },

    /**
     * Get document download URL via API gateway
     * @param {string} cid - IPFS CID
     * @param {string} filename - Optional filename for download
     * @returns {string} - API URL for document download
     */
    getDocumentDownloadUrl(cid, filename) {
        if (!cid) return ''
        const baseUrl = httpClient.getBaseUrl()
        const params = filename ? `?filename=${encodeURIComponent(filename)}` : ''
        return `${baseUrl}/api/v1/documents/${cid}/download${params}`
    },

    /**
     * Get document metadata
     * @param {string} cid - IPFS CID
     * @returns {Promise}
     */
    async getDocumentMetadata(cid) {
        const response = await httpClient.get(`/api/v1/documents/${cid}/metadata`)
        return response
    },

    /**
     * Verify document integrity
     * @param {Object} params - Verification parameters
     * @param {string} params.cid - IPFS CID
     * @param {string} [params.expectedHash] - Expected SHA256 hash
     * @param {string} [params.batchId] - Batch ID to fetch hash from blockchain
     * @param {string} [params.docType] - Document type
     * @returns {Promise}
     */
    async verifyDocument(params) {
        const response = await httpClient.post('/api/v1/documents/verify', params)
        return response
    },

    /**
     * Public document verification with file upload
     * Verifies uploaded document against IPFS stored document
     * @param {string} cid - IPFS CID from QR code
     * @param {File} file - File to verify
     * @returns {Promise}
     */
    async publicVerify(cid, file) {
        const formData = new FormData()
        formData.append('file', file)

        // Use upload method which handles FormData correctly (no JSON.stringify, browser sets Content-Type with boundary)
        const response = await httpClient.upload(`/api/v1/documents/public-verify?cid=${encodeURIComponent(cid)}`, formData)
        return response
    },

    /**
     * Public certificate verification via QR Code
     * Verifies certificate number against batch ID
     * @param {string} certNumber - Certificate number
     * @param {string} batchId - Batch ID
     * @returns {Promise}
     */
    async verifyCertificate(certNumber, batchId) {
        const response = await httpClient.get(`/api/v1/documents/verify-certificate?cert=${encodeURIComponent(certNumber)}&batch=${encodeURIComponent(batchId)}`)
        return response
    },

    /**
     * Download document as blob
     * @param {string} cid - IPFS CID
     * @returns {Promise<Blob>}
     */
    async downloadDocument(cid) {
        const response = await httpClient.get(`/api/v1/documents/${cid}`, {
            responseType: 'blob'
        })
        return response
    }
}

export default documentService
