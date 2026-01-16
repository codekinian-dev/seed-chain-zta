/**
 * Error Handler Utility
 * Centralized error handling and formatting
 */

/**
 * Error types
 */
export const ErrorType = {
    NETWORK: 'NETWORK_ERROR',
    AUTHENTICATION: 'AUTHENTICATION_ERROR',
    AUTHORIZATION: 'AUTHORIZATION_ERROR',
    VALIDATION: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    SERVER: 'SERVER_ERROR',
    UNKNOWN: 'UNKNOWN_ERROR',
}

/**
 * Get error type from status code
 */
export function getErrorType(status) {
    if (!status) return ErrorType.NETWORK

    switch (status) {
        case 401:
            return ErrorType.AUTHENTICATION
        case 403:
            return ErrorType.AUTHORIZATION
        case 404:
            return ErrorType.NOT_FOUND
        case 422:
            return ErrorType.VALIDATION
        case 500:
        case 502:
        case 503:
        case 504:
            return ErrorType.SERVER
        default:
            return ErrorType.UNKNOWN
    }
}

/**
 * Format error for display
 */
export function formatError(error) {
    const errorType = getErrorType(error.status)

    // Default messages
    const defaultMessages = {
        [ErrorType.NETWORK]: 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.',
        [ErrorType.AUTHENTICATION]: 'Sesi Anda telah berakhir. Silakan login kembali.',
        [ErrorType.AUTHORIZATION]: 'Anda tidak memiliki akses untuk melakukan aksi ini.',
        [ErrorType.NOT_FOUND]: 'Data yang Anda cari tidak ditemukan.',
        [ErrorType.VALIDATION]: 'Data yang Anda masukkan tidak valid.',
        [ErrorType.SERVER]: 'Terjadi kesalahan pada server. Silakan coba lagi nanti.',
        [ErrorType.UNKNOWN]: 'Terjadi kesalahan yang tidak diketahui.',
    }

    return {
        type: errorType,
        message: error.message || defaultMessages[errorType],
        status: error.status,
        data: error.data,
    }
}

/**
 * Extract validation errors from API response
 */
export function extractValidationErrors(error) {
    if (error.status !== 422 || !error.data) {
        return {}
    }

    const errors = {}

    // Handle different error formats
    if (error.data.errors && Array.isArray(error.data.errors)) {
        error.data.errors.forEach(err => {
            if (err.field) {
                errors[err.field] = err.message
            }
        })
    } else if (error.data.details) {
        // Handle details object format
        Object.keys(error.data.details).forEach(field => {
            errors[field] = error.data.details[field]
        })
    }

    return errors
}

/**
 * Toast notification helper
 */
export function showErrorNotification(error, notificationFn) {
    const formattedError = formatError(error)

    if (notificationFn) {
        notificationFn({
            type: 'error',
            title: 'Error',
            message: formattedError.message,
        })
    } else {
        console.error('Error:', formattedError)
    }
}

/**
 * Log error for debugging
 */
export function logError(error, context = '') {
    if (process.env.NODE_ENV === 'development') {
        console.group(`🔴 Error ${context ? `in ${context}` : ''}`)
        console.error('Message:', error.message)
        console.error('Status:', error.status)
        console.error('Data:', error.data)
        console.error('Stack:', error.stack)
        console.groupEnd()
    }
}
