/**
 * Health Service
 * Health check and monitoring endpoints
 */

import httpClient from '../http-client'

const healthService = {
    /**
     * Get overall system health status
     * @returns {Promise}
     */
    async getHealth() {
        const response = await httpClient.get('/api/health')
        return response
    },

    /**
     * Kubernetes liveness probe
     * @returns {Promise}
     */
    async getLiveness() {
        const response = await httpClient.get('/api/health/liveness')
        return response
    },

    /**
     * Kubernetes readiness probe
     * @returns {Promise}
     */
    async getReadiness() {
        const response = await httpClient.get('/api/health/readiness')
        return response
    },
}

export default healthService
