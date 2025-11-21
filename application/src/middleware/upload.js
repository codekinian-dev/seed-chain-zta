const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * Multer disk storage configuration
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with timestamp
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        const ext = path.extname(file.originalname);
        const basename = path.basename(file.originalname, ext);
        const filename = `${basename}-${uniqueSuffix}${ext}`;

        cb(null, filename);
    }
});

/**
 * File filter for allowed types
 */
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/jpg',
        'image/png'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        logger.info('[Upload] File type accepted', {
            filename: file.originalname,
            mimetype: file.mimetype
        });
        cb(null, true);
    } else {
        logger.warn('[Upload] File type rejected', {
            filename: file.originalname,
            mimetype: file.mimetype
        });
        cb(new Error(`Invalid file type: ${file.mimetype}. Allowed types: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG`), false);
    }
};

/**
 * Multer configuration
 */
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
        files: 1 // Single file upload
    }
});

/**
 * Error handling middleware for multer
 */
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Multer specific errors
        logger.error('[Upload] Multer error', {
            error: err.message,
            code: err.code,
            field: err.field
        });

        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'Upload Error',
                message: `File size exceeds maximum allowed size of ${(parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024) / 1024 / 1024}MB`
            });
        }

        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                error: 'Upload Error',
                message: 'Only one file can be uploaded at a time'
            });
        }

        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                error: 'Upload Error',
                message: `Unexpected field: ${err.field}`
            });
        }

        return res.status(400).json({
            error: 'Upload Error',
            message: err.message
        });
    }

    if (err) {
        // Other errors (e.g., from fileFilter)
        logger.error('[Upload] Upload error', {
            error: err.message
        });

        return res.status(400).json({
            error: 'Upload Error',
            message: err.message
        });
    }

    next();
};

/**
 * Log successful upload
 */
const logUpload = (req, res, next) => {
    if (req.file) {
        logger.audit('FILE_UPLOADED', req.user?.id, req.file.filename, {
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            path: req.file.path
        });
    }
    next();
};

/**
 * Cleanup uploaded file (use in error handlers)
 */
const cleanupFile = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info('[Upload] Cleaned up file', { filePath });
        }
    } catch (error) {
        logger.error('[Upload] Error cleaning up file', {
            filePath,
            error: error.message
        });
    }
};

module.exports = {
    upload,
    handleUploadError,
    logUpload,
    cleanupFile,
    uploadDir
};
