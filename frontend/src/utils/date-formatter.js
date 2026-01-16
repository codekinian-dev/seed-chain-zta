/**
 * Date Formatter Utility
 * Common date formatting functions
 */

/**
 * Format date to Indonesian locale
 */
export function formatDate(date, options = {}) {
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        ...options,
    }

    return new Date(date).toLocaleDateString('id-ID', defaultOptions)
}

/**
 * Format datetime to Indonesian locale
 */
export function formatDateTime(date, options = {}) {
    const defaultOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options,
    }

    return new Date(date).toLocaleString('id-ID', defaultOptions)
}

/**
 * Format date to relative time (e.g., "2 hari yang lalu")
 */
export function formatRelativeTime(date) {
    const now = new Date()
    const past = new Date(date)
    const diffInSeconds = Math.floor((now - past) / 1000)

    if (diffInSeconds < 60) {
        return 'Baru saja'
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
        return `${diffInMinutes} menit yang lalu`
    }

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) {
        return `${diffInHours} jam yang lalu`
    }

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) {
        return `${diffInDays} hari yang lalu`
    }

    const diffInWeeks = Math.floor(diffInDays / 7)
    if (diffInWeeks < 4) {
        return `${diffInWeeks} minggu yang lalu`
    }

    const diffInMonths = Math.floor(diffInDays / 30)
    if (diffInMonths < 12) {
        return `${diffInMonths} bulan yang lalu`
    }

    const diffInYears = Math.floor(diffInDays / 365)
    return `${diffInYears} tahun yang lalu`
}

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date) {
    return new Date(date).toISOString().split('T')[0]
}

/**
 * Format time only (HH:MM)
 */
export function formatTime(date) {
    return new Date(date).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
    })
}

/**
 * Parse date string to Date object
 */
export function parseDate(dateString) {
    return new Date(dateString)
}

/**
 * Check if date is today
 */
export function isToday(date) {
    const today = new Date()
    const checkDate = new Date(date)

    return (
        checkDate.getDate() === today.getDate() &&
        checkDate.getMonth() === today.getMonth() &&
        checkDate.getFullYear() === today.getFullYear()
    )
}

/**
 * Check if date is in the past
 */
export function isPast(date) {
    return new Date(date) < new Date()
}

/**
 * Check if date is in the future
 */
export function isFuture(date) {
    return new Date(date) > new Date()
}
