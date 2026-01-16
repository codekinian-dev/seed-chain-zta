/**
 * HTTP Client Configuration
 * Base HTTP client with interceptors for authentication and error handling
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://gateway.jabarchain.me'

/**
 * Custom HTTP client class
 */
class HttpClient {
    constructor(baseURL = BASE_URL) {
        this.baseURL = baseURL
        this.defaultHeaders = {
            'Content-Type': 'application/json',
        }
    }

    /**
     * Get authorization token from localStorage
     */
    getAuthToken() {
        return localStorage.getItem('access_token')
    }

    /**
     * Build headers with authentication
     */
    buildHeaders(customHeaders = {}) {
        const headers = { ...this.defaultHeaders, ...customHeaders }
        const token = this.getAuthToken()

        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }

        return headers
    }

    /**
     * Handle HTTP response
     */
    async handleResponse(response) {
        // Clone response for error handling
        const clonedResponse = response.clone()

        if (!response.ok) {
            let errorData
            try {
                errorData = await clonedResponse.json()
            } catch {
                errorData = { message: response.statusText }
            }

            const error = new Error(errorData.message || 'Request failed')
            error.status = response.status
            error.data = errorData

            // Handle unauthorized
            if (response.status === 401) {
                this.handleUnauthorized()
            }

            throw error
        }

        // Handle no content
        if (response.status === 204) {
            return null
        }

        return response.json()
    }

    /**
     * Handle unauthorized access
     */
    handleUnauthorized() {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')

        // Redirect to login if not already there
        if (window.location.pathname !== '/login') {
            window.location.href = '/login'
        }
    }

    /**
     * Make HTTP request
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`
        const config = {
            ...options,
            headers: this.buildHeaders(options.headers),
        }

        try {
            const response = await fetch(url, config)
            return await this.handleResponse(response)
        } catch (error) {
            console.error('HTTP Request Error:', error)
            throw error
        }
    }

    /**
     * GET request
     */
    async get(endpoint, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'GET',
        })
    }

    /**
     * POST request
     */
    async post(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data),
        })
    }

    /**
     * PUT request
     */
    async put(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data),
        })
    }

    /**
     * PATCH request
     */
    async patch(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PATCH',
            body: JSON.stringify(data),
        })
    }

    /**
     * DELETE request
     */
    async delete(endpoint, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'DELETE',
        })
    }

    /**
     * Upload file (multipart/form-data)
     */
    async upload(endpoint, formData, options = {}) {
        const headers = this.buildHeaders(options.headers)
        delete headers['Content-Type'] // Let browser set Content-Type with boundary

        return this.request(endpoint, {
            ...options,
            method: 'POST',
            headers,
            body: formData,
        })
    }
}

// Create and export default instance
const httpClient = new HttpClient()

export default httpClient
export { HttpClient }
