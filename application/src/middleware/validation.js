const Joi = require('joi');
const logger = require('../utils/logger');

/**
 * Validation schemas for seed batch operations
 */

// Create Seed Batch Schema
const createSeedBatchSchema = Joi.object({
    varietyName: Joi.string().required().min(2).max(100)
        .messages({
            'string.empty': 'Variety name is required',
            'string.min': 'Variety name must be at least 2 characters',
            'string.max': 'Variety name must not exceed 100 characters'
        }),

    commodity: Joi.string().required().min(2).max(50)
        .messages({
            'string.empty': 'Commodity is required'
        }),

    harvestDate: Joi.date().iso().required()
        .messages({
            'date.base': 'Harvest date must be a valid date',
            'any.required': 'Harvest date is required'
        }),

    seedSourceNumber: Joi.string().required().min(5).max(50)
        .messages({
            'string.empty': 'Seed source number is required'
        }),

    origin: Joi.string().required().min(2).max(100)
        .messages({
            'string.empty': 'Origin is required'
        }),

    iupNumber: Joi.string().required().min(5).max(50)
        .messages({
            'string.empty': 'IUP number is required'
        }),

    seedClass: Joi.string().valid('BS', 'BD', 'BP', 'BR')
        .required()
        .messages({
            'any.only': 'Seed class must be one of: BS (Breeder Seed), BD (Foundation Seed), BP (Stock Seed), BR (Extension Seed)',
            'any.required': 'Seed class is required'
        })
});

// Create Seed Batch Schema for Load Testing (all fields optional)
const createSeedBatchLoadTestSchema = Joi.object({
    varietyName: Joi.string().min(2).max(100).optional(),
    commodity: Joi.string().min(2).max(50).optional(),
    harvestDate: Joi.date().iso().optional(),
    seedSourceNumber: Joi.string().min(5).max(50).optional(),
    origin: Joi.string().min(2).max(100).optional(),
    iupNumber: Joi.string().min(5).max(50).optional(),
    seedClass: Joi.string().valid('BS', 'BD', 'BP', 'BR').optional(),
    documentName: Joi.string().optional()
}).unknown(true); // Allow extra fields for flexibility

// Submit Certification Schema
const submitCertificationSchema = Joi.object({
    // No body validation needed - only file upload required
    // The document is handled by validateFileUpload middleware
}).unknown(true); // Allow any fields for future extensibility

// Record Inspection Schema
const recordInspectionSchema = Joi.object({
    inspectionResult: Joi.string().required().min(10).max(2000)
        .messages({
            'string.empty': 'Inspection result is required',
            'string.min': 'Inspection result must be at least 10 characters'
        })
});

// Evaluation Schema
const evaluateInspectionSchema = Joi.object({
    approvalStatus: Joi.string().valid('APPROVE', 'REJECT').required()
        .messages({
            'any.only': 'Approval status must be either "APPROVE" or "REJECT"',
            'any.required': 'Approval status is required'
        }),

    evaluationNote: Joi.string().required().min(10).max(2000)
        .messages({
            'string.empty': 'Evaluation note is required',
            'string.min': 'Evaluation note must be at least 10 characters'
        })
});

// Issue Certificate Schema
const issueCertificateSchema = Joi.object({
    certificateNumber: Joi.string().required().min(5).max(50)
        .messages({
            'string.empty': 'Certificate number is required'
        }),

    expiryMonths: Joi.number().integer().min(1).max(120).required()
        .messages({
            'number.base': 'Expiry months must be a number',
            'number.min': 'Expiry months must be at least 1',
            'number.max': 'Expiry months cannot exceed 120',
            'any.required': 'Expiry months is required'
        })
});

// Distribution Schema
const distributeSchema = Joi.object({
    distributionLocation: Joi.string().required().min(5).max(200)
        .messages({
            'string.empty': 'Distribution location is required',
            'string.min': 'Distribution location must be at least 5 characters'
        }),

    quantity: Joi.number().positive().required()
        .messages({
            'number.base': 'Quantity must be a number',
            'number.positive': 'Quantity must be positive',
            'any.required': 'Quantity is required'
        })
});

// ID parameter validation
const idSchema = Joi.object({
    id: Joi.string().required().min(3).max(100)
        .messages({
            'string.empty': 'ID is required'
        })
});

/**
 * Validate request body against schema
 */
const validateBody = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            logger.warn('[Validation] Request validation failed', {
                path: req.path,
                errors
            });

            return res.status(400).json({
                error: 'Validation Error',
                message: 'Request validation failed',
                details: errors
            });
        }

        // Replace body with validated and sanitized value
        req.body = value;
        next();
    };
};

/**
 * Validate request params against schema
 */
const validateParams = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.params, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            logger.warn('[Validation] Parameter validation failed', {
                path: req.path,
                errors
            });

            return res.status(400).json({
                error: 'Validation Error',
                message: 'Parameter validation failed',
                details: errors
            });
        }

        req.params = value;
        next();
    };
};

/**
 * Validate file upload
 */
const validateFileUpload = (options = {}) => {
    const {
        required = true,
        maxSize = 10 * 1024 * 1024, // 10MB default
        allowedMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'image/jpeg',
            'image/png'
        ]
    } = options;

    return (req, res, next) => {
        // Check if file is required
        if (required && !req.file) {
            logger.warn('[Validation] Required file missing', {
                path: req.path
            });

            return res.status(400).json({
                error: 'Validation Error',
                message: 'File upload is required'
            });
        }

        // If file not required and not present, continue
        if (!req.file) {
            return next();
        }

        // Check file size
        if (req.file.size > maxSize) {
            logger.warn('[Validation] File too large', {
                path: req.path,
                size: req.file.size,
                maxSize
            });

            return res.status(400).json({
                error: 'Validation Error',
                message: `File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`
            });
        }

        // Check mime type
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
            logger.warn('[Validation] Invalid file type', {
                path: req.path,
                mimetype: req.file.mimetype,
                allowedTypes: allowedMimeTypes
            });

            return res.status(400).json({
                error: 'Validation Error',
                message: `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`
            });
        }

        logger.info('[Validation] File upload validated', {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size
        });

        next();
    };
};

module.exports = {
    // Schemas
    createSeedBatchSchema,
    createSeedBatchLoadTestSchema,
    submitCertificationSchema,
    recordInspectionSchema,
    evaluateInspectionSchema,
    issueCertificateSchema,
    distributeSchema,
    idSchema,

    // Validators
    validateBody,
    validateParams,
    validateFileUpload
};
