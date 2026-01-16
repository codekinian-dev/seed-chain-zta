/**
 * Constants
 * Application-wide constants
 */

// API endpoints
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://gateway.jabarchain.me'

// User roles
export const USER_ROLES = {
    PRODUCER: 'role_producer',
    PBT_FIELD: 'role_pbt_field',
    PBT_CHIEF: 'role_pbt_chief',
    LSM_HEAD: 'role_lsm_head',
}

// User role labels (Indonesian)
export const USER_ROLE_LABELS = {
    role_producer: 'Producer',
    role_pbt_field: 'PBT Field',
    role_pbt_chief: 'PBT Chief',
    role_lsm_head: 'LSM Head',
}

// Batch status
export const BATCH_STATUS = {
    CREATED: 'CREATED',
    SUBMITTED: 'SUBMITTED',
    INSPECTED: 'INSPECTED',
    EVALUATED: 'EVALUATED',
    CERTIFIED: 'CERTIFIED',
    DISTRIBUTED: 'DISTRIBUTED',
    REJECTED: 'REJECTED',
}

// Batch status labels (Indonesian)
export const BATCH_STATUS_LABELS = {
    CREATED: 'Dibuat',
    SUBMITTED: 'Diajukan',
    INSPECTED: 'Diperiksa',
    EVALUATED: 'Dievaluasi',
    CERTIFIED: 'Tersertifikasi',
    DISTRIBUTED: 'Didistribusikan',
    REJECTED: 'Ditolak',
}

// Batch status colors
export const BATCH_STATUS_COLORS = {
    CREATED: 'gray',
    SUBMITTED: 'blue',
    INSPECTED: 'yellow',
    EVALUATED: 'orange',
    CERTIFIED: 'green',
    DISTRIBUTED: 'purple',
    REJECTED: 'red',
}

// File upload limits
export const FILE_LIMITS = {
    MAX_SIZE_MB: 10,
    ALLOWED_TYPES: [
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
}

// Pagination
export const PAGINATION = {
    DEFAULT_PAGE_SIZE: 10,
    PAGE_SIZE_OPTIONS: [10, 20, 50, 100],
}

// Date formats
export const DATE_FORMATS = {
    DISPLAY: 'DD MMMM YYYY',
    INPUT: 'YYYY-MM-DD',
    DATETIME: 'DD MMMM YYYY HH:mm',
    TIME: 'HH:mm',
}

// Local storage keys
export const STORAGE_KEYS = {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    USER: 'user',
    THEME: 'theme',
    LANGUAGE: 'language',
}

// API response codes
export const RESPONSE_CODES = {
    SUCCESS: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    VALIDATION_ERROR: 422,
    SERVER_ERROR: 500,
}

// Seed classes
export const SEED_CLASSES = {
    FS: 'Foundation Seed (FS)',
    SS: 'Stock Seed (SS)',
    ES: 'Extension Seed (ES)',
}

// Certification types
export const CERTIFICATION_TYPES = {
    FIELD: 'Field Certification',
    LAB: 'Laboratory Certification',
    FULL: 'Full Certification',
}

export default {
    API_BASE_URL,
    USER_ROLES,
    BATCH_STATUS,
    BATCH_STATUS_LABELS,
    BATCH_STATUS_COLORS,
    FILE_LIMITS,
    PAGINATION,
    DATE_FORMATS,
    STORAGE_KEYS,
    RESPONSE_CODES,
    SEED_CLASSES,
    CERTIFICATION_TYPES,
}
