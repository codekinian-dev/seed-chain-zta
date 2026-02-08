/**
 * useAuth Composable
 * Authentication state management
 */

import { ref, computed } from 'vue'
import { identityService } from '../services/api'

const user = ref(identityService.getCurrentUser())
const isAuthenticated = ref(identityService.isAuthenticated())
const isLoading = ref(false)
const error = ref(null)

export function useAuth() {
    /**
     * Login user
     */
    const login = async (credentials) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await identityService.login(credentials)
            user.value = response.user
            isAuthenticated.value = true

            // Ensure state is synchronized
            await new Promise(resolve => setTimeout(resolve, 50))

            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Register user
     */
    const register = async (userData) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await identityService.register(userData)
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Register and enroll user
     */
    const registerAndEnroll = async (userData) => {
        isLoading.value = true
        error.value = null

        try {
            const response = await identityService.registerAndEnroll(userData)
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Enroll user identity in blockchain
     */
    const enroll = async () => {
        isLoading.value = true
        error.value = null

        try {
            const response = await identityService.enroll()
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Re-enroll user identity (refresh certificate)
     */
    const reenroll = async () => {
        isLoading.value = true
        error.value = null

        try {
            const response = await identityService.reenroll()
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Check identity status
     */
    const checkIdentityStatus = async () => {
        isLoading.value = true
        error.value = null

        try {
            const response = await identityService.getStatus()
            return response
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Logout user
     */
    const logout = () => {
        identityService.logout()
        user.value = null
        isAuthenticated.value = false
    }

    /**
     * Refresh user data
     */
    const refreshUser = () => {
        user.value = identityService.getCurrentUser()
        isAuthenticated.value = identityService.isAuthenticated()
    }

    return {
        // State
        user: computed(() => user.value),
        isAuthenticated: computed(() => isAuthenticated.value),
        isLoading: computed(() => isLoading.value),
        error: computed(() => error.value),

        // Methods
        login,
        register,
        registerAndEnroll,
        enroll,
        reenroll,
        checkIdentityStatus,
        logout,
        refreshUser,
    }
}
