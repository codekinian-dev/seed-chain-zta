const {
    logAccess,
    logAuthentication,
    logSecurityEvent,
    Severity
} = require('../utils/auditLogger');

/**
 * Comprehensive Audit Middleware for Zero Trust Architecture
 * 
 * Tracks:
 * - All HTTP requests and responses
 * - Request/response timing
 * - User context
 * - Security-relevant headers
 * - Anomalies and suspicious patterns
 */

// Track request metrics
const requestMetrics = {
    totalRequests: 0,
    failedRequests: 0,
    suspiciousRequests: 0,
    averageResponseTime: 0
};

/**
 * Main audit middleware
 */
function auditMiddleware(req, res, next) {
    const startTime = Date.now();

    // Generate request ID
    const requestId = generateRequestId();
    req.requestId = requestId;

    // Extract user information (if authenticated)
    const user = extractUser(req);

    // Capture original end function
    const originalEnd = res.end;
    const originalJson = res.json;

    // Track response body for audit
    let responseBody = null;

    // Override res.json to capture response
    res.json = function (data) {
        responseBody = data;
        return originalJson.call(this, data);
    };

    // Override res.end to capture and log
    res.end = function (chunk, encoding) {
        res.end = originalEnd;

        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;

        // Build audit context
        const context = {
            requestId,
            ip: getClientIp(req),
            userAgent: req.get('user-agent'),
            path: req.path,
            method: req.method,
            statusCode,
            duration,
            protocol: req.protocol,
            hostname: req.hostname,
            query: req.query,
            headers: sanitizeHeaders(req.headers)
        };

        // Log the access
        logAccess(
            user,
            {
                type: extractResourceType(req.path),
                id: extractResourceId(req),
                action: mapMethodToAction(req.method)
            },
            mapMethodToAction(req.method),
            {
                success: statusCode < 400,
                errorCode: statusCode >= 400 ? statusCode : null,
                dataSize: chunk ? Buffer.byteLength(chunk) : 0
            },
            context
        );

        // Update metrics
        updateMetrics(statusCode, duration);

        // Detect and log suspicious activity
        detectSuspiciousActivity(req, res, user, context);

        // Call original end
        res.end.call(this, chunk, encoding);
    };

    next();
}

/**
 * Authentication audit middleware
 * Specifically tracks authentication attempts
 */
function auditAuthentication(req, res, next) {
    const originalJson = res.json;

    res.json = function (data) {
        const user = extractUser(req);
        const success = res.statusCode < 400;

        logAuthentication(
            success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
            user || { username: req.body?.username || 'unknown' },
            {
                ip: getClientIp(req),
                userAgent: req.get('user-agent'),
                method: req.body?.grant_type || 'unknown',
                timestamp: new Date().toISOString()
            }
        );

        return originalJson.call(this, data);
    };

    next();
}

/**
 * Sensitive operation audit
 * For critical operations that need extra logging
 */
function auditSensitiveOperation(operationType) {
    return (req, res, next) => {
        const user = extractUser(req);
        const startTime = Date.now();

        // Log operation start
        logSecurityEvent(
            `SENSITIVE_OP_START_${operationType}`,
            Severity.INFO,
            user,
            {
                ip: getClientIp(req),
                userAgent: req.get('user-agent'),
                path: req.path,
                method: req.method,
                operation: operationType,
                description: `Sensitive operation ${operationType} started`
            }
        );

        // Capture response
        const originalJson = res.json;
        res.json = function (data) {
            const duration = Date.now() - startTime;
            const success = res.statusCode < 400;

            logSecurityEvent(
                `SENSITIVE_OP_${success ? 'SUCCESS' : 'FAILED'}_${operationType}`,
                success ? Severity.INFO : Severity.HIGH,
                user,
                {
                    ip: getClientIp(req),
                    userAgent: req.get('user-agent'),
                    path: req.path,
                    statusCode: res.statusCode,
                    duration,
                    operation: operationType,
                    description: `Sensitive operation ${operationType} ${success ? 'completed' : 'failed'}`
                }
            );

            return originalJson.call(this, data);
        };

        next();
    };
}

/**
 * Helper Functions
 */

// Generate unique request ID
function generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Extract user from request
function extractUser(req) {
    if (!req.kauth || !req.kauth.grant) {
        return null;
    }

    const token = req.kauth.grant.access_token;
    return {
        id: token.content.sub,
        username: token.content.preferred_username,
        email: token.content.email,
        roles: token.content.realm_access?.roles || []
    };
}

// Get real client IP (considering proxies)
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.ip;
}

// Sanitize headers (remove sensitive data)
function sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    sensitiveHeaders.forEach(header => {
        if (sanitized[header]) {
            sanitized[header] = '[REDACTED]';
        }
    });

    return sanitized;
}

// Extract resource type from path
function extractResourceType(path) {
    const parts = path.split('/').filter(p => p);
    return parts[1] || 'unknown';
}

// Extract resource ID from request
function extractResourceId(req) {
    return req.params?.id ||
        req.params?.batchId ||
        req.params?.certId ||
        req.body?.id ||
        'unknown';
}

// Map HTTP method to action
function mapMethodToAction(method) {
    const mapping = {
        'GET': 'read',
        'POST': 'create',
        'PUT': 'update',
        'PATCH': 'update',
        'DELETE': 'delete'
    };
    return mapping[method] || method.toLowerCase();
}

// Update request metrics
function updateMetrics(statusCode, duration) {
    requestMetrics.totalRequests++;

    if (statusCode >= 400) {
        requestMetrics.failedRequests++;
    }

    // Calculate rolling average
    requestMetrics.averageResponseTime =
        (requestMetrics.averageResponseTime * (requestMetrics.totalRequests - 1) + duration)
        / requestMetrics.totalRequests;
}

// Detect suspicious activity patterns
function detectSuspiciousActivity(req, res, user, context) {
    const suspiciousIndicators = [];

    // 1. Multiple failed authentication attempts
    if (req.path.includes('/auth') && res.statusCode === 401) {
        suspiciousIndicators.push('FAILED_AUTH_ATTEMPT');
    }

    // 2. Access to non-existent resources (scanning)
    if (res.statusCode === 404 && isResourcePath(req.path)) {
        suspiciousIndicators.push('RESOURCE_SCANNING');
    }

    // 3. Unusual user agent
    const userAgent = req.get('user-agent') || '';
    if (isSuspiciousUserAgent(userAgent)) {
        suspiciousIndicators.push('SUSPICIOUS_USER_AGENT');
    }

    // 4. Access outside business hours (if configured)
    if (isOutsideBusinessHours()) {
        suspiciousIndicators.push('OFF_HOURS_ACCESS');
    }

    // 5. High request rate from single IP (potential DoS)
    if (isHighRequestRate(context.ip)) {
        suspiciousIndicators.push('HIGH_REQUEST_RATE');
    }

    // 6. Access denied by policy
    if (res.statusCode === 403) {
        suspiciousIndicators.push('POLICY_DENIAL');
    }

    // 7. SQL injection patterns
    if (hasSqlInjectionPattern(req)) {
        suspiciousIndicators.push('SQL_INJECTION_ATTEMPT');
    }

    // 8. Path traversal patterns
    if (hasPathTraversalPattern(req)) {
        suspiciousIndicators.push('PATH_TRAVERSAL_ATTEMPT');
    }

    // Log if suspicious activity detected
    if (suspiciousIndicators.length > 0) {
        requestMetrics.suspiciousRequests++;

        const severity = calculateSeverity(suspiciousIndicators);

        logSecurityEvent(
            'SUSPICIOUS_ACTIVITY_DETECTED',
            severity,
            user,
            {
                ip: context.ip,
                userAgent: context.userAgent,
                path: context.path,
                method: context.method,
                statusCode: context.statusCode,
                indicators: suspiciousIndicators,
                description: `Suspicious activity detected: ${suspiciousIndicators.join(', ')}`,
                response: severity === Severity.CRITICAL ? 'IP_BLOCKED' : 'LOGGED'
            }
        );
    }
}

// Check if path is a resource path
function isResourcePath(path) {
    const resourcePaths = ['/api/seed-batches', '/api/certificates', '/api/inspections'];
    return resourcePaths.some(p => path.startsWith(p));
}

// Check for suspicious user agents
function isSuspiciousUserAgent(userAgent) {
    const suspiciousPatterns = [
        /curl/i,
        /wget/i,
        /scanner/i,
        /bot/i,
        /crawl/i,
        /sqlmap/i,
        /nikto/i
    ];
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
}

// Check if outside business hours (22:00 - 06:00)
function isOutsideBusinessHours() {
    const hour = new Date().getHours();
    return hour >= 22 || hour < 6;
}

// Track request rates per IP
const ipRequestTracker = new Map();

function isHighRequestRate(ip) {
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    const threshold = 100; // requests per minute

    if (!ipRequestTracker.has(ip)) {
        ipRequestTracker.set(ip, []);
    }

    const requests = ipRequestTracker.get(ip);

    // Clean old requests
    const recentRequests = requests.filter(time => now - time < timeWindow);
    recentRequests.push(now);

    ipRequestTracker.set(ip, recentRequests);

    return recentRequests.length > threshold;
}

// Check for SQL injection patterns
function hasSqlInjectionPattern(req) {
    const sqlPatterns = [
        /(\bor\b|\band\b).*=.*=/i,
        /union.*select/i,
        /insert.*into/i,
        /delete.*from/i,
        /drop.*table/i,
        /exec(\s|\+)+(s|x)p\w+/i
    ];

    const checkString = JSON.stringify(req.query) + JSON.stringify(req.body);
    return sqlPatterns.some(pattern => pattern.test(checkString));
}

// Check for path traversal patterns
function hasPathTraversalPattern(req) {
    const pathPatterns = [
        /\.\./,
        /%2e%2e/i,
        /\.\%252e/i
    ];

    const checkString = req.path + JSON.stringify(req.query);
    return pathPatterns.some(pattern => pattern.test(checkString));
}

// Calculate severity based on indicators
function calculateSeverity(indicators) {
    if (indicators.includes('SQL_INJECTION_ATTEMPT') ||
        indicators.includes('PATH_TRAVERSAL_ATTEMPT')) {
        return Severity.CRITICAL;
    }

    if (indicators.includes('HIGH_REQUEST_RATE') ||
        indicators.length >= 3) {
        return Severity.HIGH;
    }

    if (indicators.includes('POLICY_DENIAL') ||
        indicators.includes('FAILED_AUTH_ATTEMPT')) {
        return Severity.MEDIUM;
    }

    return Severity.LOW;
}

// Get current metrics
function getMetrics() {
    return {
        ...requestMetrics,
        timestamp: new Date().toISOString()
    };
}

// Reset metrics (for testing)
function resetMetrics() {
    requestMetrics.totalRequests = 0;
    requestMetrics.failedRequests = 0;
    requestMetrics.suspiciousRequests = 0;
    requestMetrics.averageResponseTime = 0;
}

module.exports = {
    auditMiddleware,
    auditAuthentication,
    auditSensitiveOperation,
    getMetrics,
    resetMetrics
};
