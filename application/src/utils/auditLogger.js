const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

const logDir = process.env.LOG_DIR || './logs';
const auditDir = path.join(logDir, 'audit');

/**
 * Enhanced Audit Logger for Zero Trust Architecture
 * 
 * Tracks:
 * - All authentication attempts
 * - Authorization decisions
 * - Resource access
 * - Policy violations
 * - Security events
 * - Anomalies
 */

// Custom format for audit logs
const auditFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf((info) => {
        return JSON.stringify({
            timestamp: info.timestamp,
            level: info.level,
            category: info.category || 'GENERAL',
            event: info.event,
            severity: info.severity || 'INFO',
            user: info.user || {},
            resource: info.resource || {},
            context: info.context || {},
            decision: info.decision || {},
            metrics: info.metrics || {},
            security: info.security || {},
            message: info.message
        });
    })
);

// Create specialized audit logger
const auditLogger = winston.createLogger({
    level: 'info',
    format: auditFormat,
    defaultMeta: {
        service: 'seed-certification-api',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: [
        // Authentication logs
        new DailyRotateFile({
            filename: path.join(auditDir, 'authentication-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '50m',
            maxFiles: '90d',
            level: 'info'
        }),
        // Authorization logs
        new DailyRotateFile({
            filename: path.join(auditDir, 'authorization-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '50m',
            maxFiles: '90d',
            level: 'info'
        }),
        // Security events
        new DailyRotateFile({
            filename: path.join(auditDir, 'security-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '50m',
            maxFiles: '90d',
            level: 'warn'
        }),
        // Access logs (all resource access)
        new DailyRotateFile({
            filename: path.join(auditDir, 'access-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '100m',
            maxFiles: '30d',
            level: 'info'
        }),
        // Policy violations
        new DailyRotateFile({
            filename: path.join(auditDir, 'violations-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '50m',
            maxFiles: '180d',
            level: 'warn'
        }),
        // Blockchain transactions
        new DailyRotateFile({
            filename: path.join(auditDir, 'blockchain-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '50m',
            maxFiles: '365d',
            level: 'info'
        })
    ]
});

// Add console for development
if (process.env.NODE_ENV !== 'production') {
    auditLogger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

/**
 * Audit Event Categories
 */
const AuditCategory = {
    AUTHENTICATION: 'AUTHENTICATION',
    AUTHORIZATION: 'AUTHORIZATION',
    ACCESS: 'ACCESS',
    SECURITY: 'SECURITY',
    POLICY: 'POLICY',
    BLOCKCHAIN: 'BLOCKCHAIN',
    DATA_CHANGE: 'DATA_CHANGE',
    SYSTEM: 'SYSTEM'
};

/**
 * Severity Levels
 */
const Severity = {
    CRITICAL: 'CRITICAL',
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
    INFO: 'INFO'
};

/**
 * Helper Functions for Structured Logging
 */

// Log authentication events
function logAuthentication(event, user, context = {}) {
    auditLogger.info({
        category: AuditCategory.AUTHENTICATION,
        event,
        severity: event.includes('FAILED') ? Severity.HIGH : Severity.INFO,
        user: {
            id: user?.id || 'unknown',
            username: user?.username || 'unknown',
            email: user?.email,
            roles: user?.roles || []
        },
        context: {
            ip: context.ip,
            userAgent: context.userAgent,
            timestamp: new Date().toISOString(),
            ...context
        },
        message: `Authentication ${event}: ${user?.username || 'unknown'}`
    });
}

// Log authorization decisions
function logAuthorization(decision, user, resource, action, context = {}) {
    auditLogger.info({
        category: AuditCategory.AUTHORIZATION,
        event: decision.allow ? 'ACCESS_GRANTED' : 'ACCESS_DENIED',
        severity: decision.allow ? Severity.INFO : Severity.MEDIUM,
        user: {
            id: user?.id || 'unknown',
            username: user?.username || 'unknown',
            roles: user?.roles || []
        },
        resource: {
            type: resource,
            action: action,
            id: context.resourceId
        },
        decision: {
            allowed: decision.allow,
            reason: decision.reason,
            matchedRole: decision.matchedRole,
            policies: decision.policies || []
        },
        context: {
            ip: context.ip,
            userAgent: context.userAgent,
            path: context.path,
            method: context.method,
            timestamp: new Date().toISOString()
        },
        message: `Authorization ${decision.allow ? 'granted' : 'denied'}: ${user?.username} → ${action} on ${resource}`
    });
}

// Log resource access
function logAccess(user, resource, action, result, context = {}) {
    auditLogger.info({
        category: AuditCategory.ACCESS,
        event: `RESOURCE_${action.toUpperCase()}`,
        severity: Severity.INFO,
        user: {
            id: user?.id || 'unknown',
            username: user?.username || 'unknown',
            roles: user?.roles || []
        },
        resource: {
            type: resource.type,
            id: resource.id,
            action: action
        },
        context: {
            ip: context.ip,
            userAgent: context.userAgent,
            path: context.path,
            method: context.method,
            statusCode: context.statusCode,
            duration: context.duration,
            timestamp: new Date().toISOString()
        },
        metrics: {
            success: result.success,
            errorCode: result.errorCode,
            dataSize: result.dataSize
        },
        message: `${user?.username} ${action} ${resource.type} ${resource.id}`
    });
}

// Log security events
function logSecurityEvent(eventType, severity, user, details = {}) {
    auditLogger.warn({
        category: AuditCategory.SECURITY,
        event: eventType,
        severity: severity,
        user: {
            id: user?.id || 'unknown',
            username: user?.username || 'unknown',
            roles: user?.roles || []
        },
        security: {
            eventType,
            threatLevel: severity,
            indicators: details.indicators || [],
            response: details.response
        },
        context: {
            ip: details.ip,
            userAgent: details.userAgent,
            timestamp: new Date().toISOString(),
            ...details
        },
        message: `Security Event: ${eventType} - ${details.description || ''}`
    });
}

// Log policy violations
function logPolicyViolation(user, resource, action, violation, context = {}) {
    auditLogger.warn({
        category: AuditCategory.POLICY,
        event: 'POLICY_VIOLATION',
        severity: Severity.HIGH,
        user: {
            id: user?.id || 'unknown',
            username: user?.username || 'unknown',
            roles: user?.roles || []
        },
        resource: {
            type: resource,
            action: action
        },
        decision: {
            violation: violation.type,
            reason: violation.reason,
            policy: violation.policy
        },
        context: {
            ip: context.ip,
            userAgent: context.userAgent,
            path: context.path,
            timestamp: new Date().toISOString(),
            ...context
        },
        message: `Policy Violation: ${user?.username} attempted ${action} on ${resource}`
    });
}

// Log blockchain transactions
function logBlockchainTransaction(txId, chaincode, action, user, result, context = {}) {
    auditLogger.info({
        category: AuditCategory.BLOCKCHAIN,
        event: `BLOCKCHAIN_${action.toUpperCase()}`,
        severity: result.success ? Severity.INFO : Severity.MEDIUM,
        user: {
            id: user?.id || 'unknown',
            username: user?.username || 'unknown'
        },
        resource: {
            type: 'BLOCKCHAIN_TX',
            id: txId,
            chaincode: chaincode,
            action: action
        },
        context: {
            transactionId: txId,
            channel: context.channel || 'seedchannel',
            endorsers: context.endorsers || [],
            timestamp: new Date().toISOString(),
            ...context
        },
        metrics: {
            success: result.success,
            duration: result.duration,
            blockNumber: result.blockNumber,
            errorMessage: result.error
        },
        message: `Blockchain TX: ${chaincode}.${action} - ${result.success ? 'Success' : 'Failed'}`
    });
}

// Log data changes
function logDataChange(user, resource, operation, before, after, context = {}) {
    auditLogger.info({
        category: AuditCategory.DATA_CHANGE,
        event: `DATA_${operation.toUpperCase()}`,
        severity: Severity.INFO,
        user: {
            id: user?.id || 'unknown',
            username: user?.username || 'unknown'
        },
        resource: {
            type: resource.type,
            id: resource.id,
            operation: operation
        },
        context: {
            before: before,
            after: after,
            changes: calculateChanges(before, after),
            timestamp: new Date().toISOString(),
            ...context
        },
        message: `Data Change: ${user?.username} ${operation} ${resource.type} ${resource.id}`
    });
}

// Log system events
function logSystemEvent(event, severity, details = {}) {
    auditLogger.info({
        category: AuditCategory.SYSTEM,
        event: event,
        severity: severity,
        context: {
            timestamp: new Date().toISOString(),
            ...details
        },
        message: `System Event: ${event}`
    });
}

// Calculate changes between before/after states
function calculateChanges(before, after) {
    if (!before || !after) return {};

    const changes = {};
    const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

    for (const key of allKeys) {
        if (before[key] !== after[key]) {
            changes[key] = {
                from: before[key],
                to: after[key]
            };
        }
    }

    return changes;
}

// Export logger and helpers
module.exports = {
    auditLogger,
    AuditCategory,
    Severity,
    logAuthentication,
    logAuthorization,
    logAccess,
    logSecurityEvent,
    logPolicyViolation,
    logBlockchainTransaction,
    logDataChange,
    logSystemEvent
};
