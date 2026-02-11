/**
 * Blockchain Audit Service
 * API service for querying audit logs from blockchain
 */

import httpClient from '../http-client'

const AUDIT_API_PREFIX = '/api/blockchain-audit'

const auditService = {
    /**
     * Query blockchain audit logs with filters
     * @param {Object} params - Query parameters
     * @param {string} params.startTime - ISO date string start time
     * @param {string} params.endTime - ISO date string end time
     * @param {string} params.action - Filter by action type
     * @param {number} params.limit - Number of records to return (default: 100)
     * @param {number} params.offset - Number of records to skip for pagination
     * @returns {Promise<Object>} Audit logs response
     */
    async getLogs(params = {}) {
        const queryParams = new URLSearchParams()

        if (params.startTime) queryParams.append('startTime', params.startTime)
        if (params.endTime) queryParams.append('endTime', params.endTime)
        if (params.action) queryParams.append('action', params.action)
        if (params.limit) queryParams.append('limit', params.limit.toString())
        if (params.offset) queryParams.append('offset', params.offset.toString())

        const queryString = queryParams.toString()
        const url = `${AUDIT_API_PREFIX}/logs${queryString ? `?${queryString}` : ''}`

        return httpClient.get(url)
    },

    /**
     * Get audit log by transaction ID
     * @param {string} txId - Blockchain transaction ID
     * @returns {Promise<Object>} Audit log details
     */
    async getByTxId(txId) {
        return httpClient.get(`${AUDIT_API_PREFIX}/tx/${txId}`)
    },

    /**
     * Get audit logs by resource ID
     * @param {string} resourceId - Resource ID (e.g., seed batch ID)
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Audit logs for the resource
     */
    async getByResourceId(resourceId, params = {}) {
        const queryParams = new URLSearchParams()

        if (params.limit) queryParams.append('limit', params.limit.toString())
        if (params.offset) queryParams.append('offset', params.offset.toString())

        const queryString = queryParams.toString()
        const url = `${AUDIT_API_PREFIX}/resource/${resourceId}${queryString ? `?${queryString}` : ''}`

        return httpClient.get(url)
    },

    /**
     * Get audit logs by user Keycloak ID
     * @param {string} keycloakId - User Keycloak ID
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} Audit logs for the user
     */
    async getByUser(keycloakId, params = {}) {
        const queryParams = new URLSearchParams()

        if (params.limit) queryParams.append('limit', params.limit.toString())
        if (params.offset) queryParams.append('offset', params.offset.toString())

        const queryString = queryParams.toString()
        const url = `${AUDIT_API_PREFIX}/user/${keycloakId}${queryString ? `?${queryString}` : ''}`

        return httpClient.get(url)
    },

    /**
     * Get audit statistics summary
     * @param {number} days - Number of days to include in statistics (default: 7)
     * @returns {Promise<Object>} Audit statistics
     */
    async getStats(days = 7) {
        return httpClient.get(`${AUDIT_API_PREFIX}/stats?days=${days}`)
    },

    /**
     * Get block history for a batch
     * @param {string} batchId - Batch ID
     * @returns {Promise<Object>} Block history with hash chain
     */
    async getBatchBlockHistory(batchId) {
        return httpClient.get(`${AUDIT_API_PREFIX}/batch/${batchId}/blocks`)
    },
}

export default auditService
