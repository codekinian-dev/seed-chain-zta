/**
 * Identity Service
 * Handles user authentication and identity management
 */

import httpClient from '../http-client'

const identityService = {
    /**
     * Register new user in Keycloak
     * @param {Object} userData - User registration data
     * @returns {Promise}
     */
    async register(userData) {
        const response = await httpClient.post('/api/v1/identity/register', {
            username: userData.username,
            email: userData.email,
            password: userData.password,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role || 'producer',
        })
        return response
    },

    /**
     * Login user and get access token
     * @param {Object} credentials - Login credentials
     * @returns {Promise}
     */
    async login(credentials) {
        const response = await httpClient.post('/api/v1/identity/login', {
            username: credentials.username,
            password: credentials.password,
        })

        console.log('Login response:', response)

        // Handle different response formats from backend
        const token = response.access_token || response.accessToken || response.token || response.data?.access_token || response.data?.accessToken
        const refreshToken = response.refresh_token || response.refreshToken || response.data?.refresh_token || response.data?.refreshToken
        const user = response.user || response.data?.user || { username: credentials.username }

        // Store tokens
        if (token) {
            console.log('Storing token:', token.substring(0, 20) + '...')
            localStorage.setItem('access_token', token)
            if (refreshToken) {
                localStorage.setItem('refresh_token', refreshToken)
            }
            localStorage.setItem('user', JSON.stringify(user))
        } else {
            console.error('No token found in response:', response)
        }

        return response
    },

    /**
     * Register and automatically enroll user
     * @param {Object} userData - User registration data
     * @returns {Promise}
     */
    async registerAndEnroll(userData) {
        const response = await httpClient.post('/api/v1/identity/register-and-enroll', {
            username: userData.username,
            email: userData.email,
            password: userData.password,
            firstName: userData.firstName,
            lastName: userData.lastName,
            role: userData.role || 'producer',
            affiliation: userData.affiliation || 'org1.department1',
        })
        return response
    },

    /**
     * Enroll user identity in Fabric CA
     * @param {Object} enrollData - Enrollment data
     * @returns {Promise}
     */
    async enroll(enrollData) {
        const response = await httpClient.post('/api/v1/identity/enroll', {
            username: enrollData.username,
            affiliation: enrollData.affiliation || 'org1.department1',
        })
        return response
    },

    /**
     * Check user identity status
     * @param {string} username - Username to check
     * @returns {Promise}
     */
    async getStatus(username) {
        const response = await httpClient.get(`/api/v1/identity/status?username=${username}`)
        return response
    },

    /**
     * Re-enroll user identity
     * @param {string} username - Username to re-enroll
     * @returns {Promise}
     */
    async reenroll(username) {
        const response = await httpClient.post('/api/v1/identity/reenroll', {
            username,
        })
        return response
    },

    /**
     * Revoke user identity
     * @param {string} username - Username to revoke
     * @returns {Promise}
     */
    async revoke(username) {
        const response = await httpClient.post('/api/v1/identity/revoke', {
            username,
        })
        return response
    },

    /**
     * List all identities
     * @returns {Promise}
     */
    async listIdentities() {
        const response = await httpClient.get('/api/v1/identity/list')
        return response
    },

    /**
     * Logout user
     */
    logout() {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')
    },

    /**
     * Get current user from localStorage
     */
    getCurrentUser() {
        const userStr = localStorage.getItem('user')
        return userStr ? JSON.parse(userStr) : null
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!localStorage.getItem('access_token')
    },
}

export default identityService
