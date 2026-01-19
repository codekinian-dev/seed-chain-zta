/**
 * Seed Batch Service
 * Handles seed batch management and certification operations
 */

import httpClient from '../http-client'

const seedBatchService = {
    /**
     * Get seed batches owned by current user
     * @returns {Promise}
     */
    async getMyBatches() {
        const response = await httpClient.get('/api/seed-batches/my-batches')
        return response
    },

    /**
     * Get all seed batches
     * @param {Object} params - Query parameters
     * @returns {Promise}
     */
    async getAllBatches(params = {}) {
        const queryString = new URLSearchParams(params).toString()
        const endpoint = queryString ? `/api/seed-batches?${queryString}` : '/api/seed-batches'
        const response = await httpClient.get(endpoint)
        return response
    },

    /**
     * Create new seed batch
     * @param {FormData} batchData - Seed batch data (FormData with file)
     * @returns {Promise}
     */
    async createBatch(batchData) {
        const response = await httpClient.upload('/api/seed-batches', batchData)
        return response
    },

    /**
     * Get seed batch by ID
     * @param {string} id - Batch ID
     * @returns {Promise}
     */
    async getBatchById(id) {
        const response = await httpClient.get(`/api/seed-batches/${id}`)
        return response
    },

    /**
     * Get seed batch history
     * @param {string} id - Batch ID
     * @returns {Promise}
     */
    async getBatchHistory(id) {
        const response = await httpClient.get(`/api/seed-batches/${id}/history`)
        return response
    },

    /**
     * Submit certification request
     * @param {string} id - Batch ID
     * @param {FormData} data - Submission data (FormData with file)
     * @returns {Promise}
     */
    async submitCertificationRequest(id, data) {
        const response = await httpClient.upload(`/api/seed-batches/${id}/submit`, data)
        return response
    },

    /**
     * Record field inspection
     * @param {string} id - Batch ID
     * @param {FormData} inspectionData - Inspection data (FormData with file)
     * @returns {Promise}
     */
    async recordInspection(id, inspectionData) {
        const response = await httpClient.upload(`/api/seed-batches/${id}/inspect`, inspectionData)
        return response
    },

    /**
     * Evaluate inspection result
     * @param {string} id - Batch ID
     * @param {Object} evaluationData - Evaluation data
     * @returns {Promise}
     */
    async evaluateInspection(id, evaluationData) {
        const response = await httpClient.post(`/api/seed-batches/${id}/evaluate`, evaluationData)
        return response
    },

    /**
     * Issue certificate
     * @param {string} id - Batch ID
     * @param {FormData} certificateData - Certificate data (FormData with file)
     * @returns {Promise}
     */
    async issueCertificate(id, certificateData) {
        const response = await httpClient.upload(`/api/seed-batches/${id}/certificate`, certificateData)
        return response
    },

    /**
     * Record seed distribution
     * @param {string} id - Batch ID
     * @param {Object} distributionData - Distribution data
     * @returns {Promise}
     */
    async recordDistribution(id, distributionData) {
        const response = await httpClient.post(`/api/seed-batches/${id}/distribute`, distributionData)
        return response
    },

    /**
     * Upload document to IPFS
     * @param {File} file - File to upload
     * @returns {Promise}
     */
    async uploadDocument(file) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await httpClient.upload('/api/ipfs/upload', formData)
        return response
    },

    /**
     * Get document from IPFS
     * @param {string} cid - IPFS CID
     * @returns {Promise}
     */
    async getDocument(cid) {
        const response = await httpClient.get(`/api/ipfs/${cid}`)
        return response
    },
}

export default seedBatchService
