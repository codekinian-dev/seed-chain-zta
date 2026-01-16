/**
 * useApi Composable
 * Generic API request handler with loading and error states
 */

import { ref } from 'vue'

export function useApi() {
    const isLoading = ref(false)
    const error = ref(null)

    /**
     * Execute API call with loading and error handling
     */
    const execute = async (apiFunction, ...args) => {
        isLoading.value = true
        error.value = null

        try {
            const result = await apiFunction(...args)
            return result
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            isLoading.value = false
        }
    }

    /**
     * Clear error
     */
    const clearError = () => {
        error.value = null
    }

    return {
        isLoading,
        error,
        execute,
        clearError,
    }
}
