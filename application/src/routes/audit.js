const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');
const { getMetrics } = require('../middleware/auditMiddleware');
const securityTracker = require('../utils/securityTracker');

/**
 * Audit and Monitoring API Routes
 * 
 * Requires admin role for access
 */

/**
 * @route GET /api/audit/logs
 * @desc Query audit logs with filters
 * @access Admin only
 */
router.get('/logs', async (req, res) => {
    try {
        const {
            category,
            startDate,
            endDate,
            userId,
            resource,
            action,
            severity,
            limit,
            offset
        } = req.query;

        const options = {
            category,
            userId,
            resource,
            action,
            severity,
            limit: parseInt(limit) || 100,
            offset: parseInt(offset) || 0
        };

        if (startDate) options.startDate = new Date(startDate);
        if (endDate) options.endDate = new Date(endDate);

        const result = await auditService.queryLogs(options);

        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/audit/user/:userId
 * @desc Get user activity summary
 * @access Admin only
 */
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { days } = req.query;

        const activity = await auditService.getUserActivity(
            userId,
            parseInt(days) || 7
        );

        res.json({
            success: true,
            data: activity
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/audit/security-events
 * @desc Get security events summary
 * @access Admin only
 */
router.get('/security-events', async (req, res) => {
    try {
        const { days } = req.query;

        const events = await auditService.getSecurityEvents(
            parseInt(days) || 1
        );

        res.json({
            success: true,
            data: events
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/audit/violations
 * @desc Get policy violations
 * @access Admin only
 */
router.get('/violations', async (req, res) => {
    try {
        const { days } = req.query;

        const violations = await auditService.getPolicyViolations(
            parseInt(days) || 7
        );

        res.json({
            success: true,
            data: violations
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/audit/blockchain
 * @desc Get blockchain transaction analytics
 * @access Admin only
 */
router.get('/blockchain', async (req, res) => {
    try {
        const { days } = req.query;

        const analytics = await auditService.getBlockchainAnalytics(
            parseInt(days) || 7
        );

        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/audit/compliance
 * @desc Generate compliance report
 * @access Admin only
 */
router.get('/compliance', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const report = await auditService.generateComplianceReport(
            new Date(startDate || Date.now() - 30 * 24 * 60 * 60 * 1000),
            new Date(endDate || Date.now())
        );

        res.json({
            success: true,
            data: report
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/audit/anomalies
 * @desc Detect anomalies in access patterns
 * @access Admin only
 */
router.get('/anomalies', async (req, res) => {
    try {
        const { days } = req.query;

        const anomalies = await auditService.detectAnomalies(
            parseInt(days) || 7
        );

        res.json({
            success: true,
            data: anomalies
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/metrics
 * @desc Get application metrics for Prometheus
 * @access Public (for Prometheus scraping)
 */
router.get('/metrics', (req, res) => {
    try {
        const metrics = getMetrics();
        const securityStats = securityTracker.getStatistics();

        // Return in Prometheus text format
        let output = '';

        // Request metrics
        output += `# HELP http_requests_total Total number of HTTP requests\n`;
        output += `# TYPE http_requests_total counter\n`;
        output += `http_requests_total ${metrics.totalRequests}\n\n`;

        output += `# HELP http_requests_failed Total number of failed HTTP requests\n`;
        output += `# TYPE http_requests_failed counter\n`;
        output += `http_requests_failed ${metrics.failedRequests}\n\n`;

        output += `# HELP http_requests_suspicious Total number of suspicious HTTP requests\n`;
        output += `# TYPE http_requests_suspicious counter\n`;
        output += `http_requests_suspicious ${metrics.suspiciousRequests}\n\n`;

        output += `# HELP http_request_duration_average Average HTTP request duration in ms\n`;
        output += `# TYPE http_request_duration_average gauge\n`;
        output += `http_request_duration_average ${metrics.averageResponseTime}\n\n`;

        // Security metrics
        output += `# HELP security_blocked_ips Number of blocked IP addresses\n`;
        output += `# TYPE security_blocked_ips gauge\n`;
        output += `security_blocked_ips ${securityStats.blockedIPs}\n\n`;

        output += `# HELP security_suspicious_ips Number of suspicious IP addresses\n`;
        output += `# TYPE security_suspicious_ips gauge\n`;
        output += `security_suspicious_ips ${securityStats.suspiciousIPs}\n\n`;

        output += `# HELP security_failed_logins Total failed login attempts\n`;
        output += `# TYPE security_failed_logins gauge\n`;
        output += `security_failed_logins ${securityStats.failedLoginAttempts}\n\n`;

        res.set('Content-Type', 'text/plain');
        res.send(output);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @route GET /api/audit/health
 * @desc Health check for audit system
 * @access Public
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        metrics: getMetrics(),
        security: securityTracker.getStatistics()
    });
});

module.exports = router;
