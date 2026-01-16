/**
 * Validation Utility
 * Common validation functions
 */

/**
 * Validate email format
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

/**
 * Validate password strength
 */
export function isValidPassword(password, options = {}) {
    const {
        minLength = 8,
        requireUppercase = true,
        requireLowercase = true,
        requireNumber = true,
        requireSpecialChar = false,
    } = options

    if (password.length < minLength) {
        return {
            valid: false,
            message: `Password minimal ${minLength} karakter`,
        }
    }

    if (requireUppercase && !/[A-Z]/.test(password)) {
        return {
            valid: false,
            message: 'Password harus mengandung huruf kapital',
        }
    }

    if (requireLowercase && !/[a-z]/.test(password)) {
        return {
            valid: false,
            message: 'Password harus mengandung huruf kecil',
        }
    }

    if (requireNumber && !/\d/.test(password)) {
        return {
            valid: false,
            message: 'Password harus mengandung angka',
        }
    }

    if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        return {
            valid: false,
            message: 'Password harus mengandung karakter spesial',
        }
    }

    return {
        valid: true,
        message: 'Password valid',
    }
}

/**
 * Validate username format
 */
export function isValidUsername(username) {
    // Username should be 3-20 characters, alphanumeric with underscores
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
    return usernameRegex.test(username)
}

/**
 * Validate required field
 */
export function isRequired(value) {
    if (typeof value === 'string') {
        return value.trim().length > 0
    }
    return value !== null && value !== undefined
}

/**
 * Validate file size
 */
export function isValidFileSize(file, maxSizeMB = 10) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    return file.size <= maxSizeBytes
}

/**
 * Validate file type
 */
export function isValidFileType(file, allowedTypes = []) {
    if (allowedTypes.length === 0) return true
    return allowedTypes.includes(file.type)
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function isValidDate(dateString) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(dateString)) return false

    const date = new Date(dateString)
    return date instanceof Date && !isNaN(date)
}

/**
 * Validate phone number (Indonesian format)
 */
export function isValidPhoneNumber(phone) {
    // Indonesian phone format: 08xx-xxxx-xxxx or +628xx-xxxx-xxxx
    const phoneRegex = /^(\+62|62|0)[8][0-9]{8,11}$/
    return phoneRegex.test(phone.replace(/[- ]/g, ''))
}

/**
 * Form validation helper
 */
export function validateForm(formData, rules) {
    const errors = {}

    Object.keys(rules).forEach(field => {
        const value = formData[field]
        const fieldRules = rules[field]

        fieldRules.forEach(rule => {
            if (rule.required && !isRequired(value)) {
                errors[field] = rule.message || `${field} wajib diisi`
            } else if (rule.email && value && !isValidEmail(value)) {
                errors[field] = rule.message || 'Format email tidak valid'
            } else if (rule.minLength && value && value.length < rule.minLength) {
                errors[field] = rule.message || `Minimal ${rule.minLength} karakter`
            } else if (rule.maxLength && value && value.length > rule.maxLength) {
                errors[field] = rule.message || `Maksimal ${rule.maxLength} karakter`
            } else if (rule.pattern && value && !rule.pattern.test(value)) {
                errors[field] = rule.message || 'Format tidak valid'
            } else if (rule.custom && value && !rule.custom(value)) {
                errors[field] = rule.message || 'Validasi gagal'
            }
        })
    })

    return {
        valid: Object.keys(errors).length === 0,
        errors,
    }
}
