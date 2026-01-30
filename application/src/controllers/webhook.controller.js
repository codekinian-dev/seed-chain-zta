/**
 * Webhook Controller
 * Handles incoming webhooks from Prometheus AlertManager
 */

const { auditLogger } = require('../utils/auditLogger');
const logger = require('../utils/logger');

/**
 * Process AlertManager webhook payload
 * @param {Object} payload - AlertManager webhook payload
 * @returns {Object} - Processed alerts
 */
const processAlertPayload = (payload) => {
    const alerts = payload.alerts || [];

    return alerts.map(alert => ({
        status: alert.status, // firing or resolved
        labels: alert.labels,
        annotations: alert.annotations,
        startsAt: alert.startsAt,
        endsAt: alert.endsAt,
        generatorURL: alert.generatorURL,
        fingerprint: alert.fingerprint
    }));
};

/**
 * Handle general alerts
 */
exports.handleGeneralAlerts = async (req, res) => {
    try {
        const payload = req.body;
        const alerts = processAlertPayload(payload);

        logger.info('Received general alerts', {
            receiver: payload.receiver,
            status: payload.status,
            alertCount: alerts.length,
            groupLabels: payload.groupLabels
        });

        // Log each alert
        alerts.forEach(alert => {
            auditLogger.logSecurityEvent({
                action: 'ALERT_RECEIVED',
                category: 'general',
                severity: alert.labels.severity || 'medium',
                alertname: alert.labels.alertname,
                status: alert.status,
                description: alert.annotations.summary || alert.annotations.description,
                details: alert
            });
        });

        res.status(200).json({
            success: true,
            message: 'Alerts received',
            processed: alerts.length
        });

    } catch (error) {
        logger.error('Error handling general alerts', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to process alerts'
        });
    }
};

/**
 * Handle security-critical alerts
 */
exports.handleSecurityAlerts = async (req, res) => {
    try {
        const payload = req.body;
        const alerts = processAlertPayload(payload);

        logger.warn('Received CRITICAL security alerts', {
            receiver: payload.receiver,
            status: payload.status,
            alertCount: alerts.length,
            groupLabels: payload.groupLabels
        });

        // Log with HIGH severity
        alerts.forEach(alert => {
            auditLogger.logSecurityEvent({
                action: 'SECURITY_ALERT_CRITICAL',
                category: 'security',
                severity: 'critical',
                alertname: alert.labels.alertname,
                status: alert.status,
                description: alert.annotations.summary || alert.annotations.description,
                details: alert
            });
        });

        // TODO: Add additional actions for critical security alerts:
        // - Send SMS/Email notifications
        // - Trigger automated response (e.g., IP blocking)
        // - Create incident ticket

        res.status(200).json({
            success: true,
            message: 'Security alerts received and logged',
            processed: alerts.length,
            severity: 'critical'
        });

    } catch (error) {
        logger.error('Error handling security alerts', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to process security alerts'
        });
    }
};

/**
 * Handle operational high-severity alerts
 */
exports.handleOpsAlerts = async (req, res) => {
    try {
        const payload = req.body;
        const alerts = processAlertPayload(payload);

        logger.warn('Received high-severity operational alerts', {
            receiver: payload.receiver,
            status: payload.status,
            alertCount: alerts.length,
            groupLabels: payload.groupLabels
        });

        alerts.forEach(alert => {
            auditLogger.logSecurityEvent({
                action: 'OPS_ALERT_HIGH',
                category: 'operations',
                severity: 'high',
                alertname: alert.labels.alertname,
                status: alert.status,
                description: alert.annotations.summary || alert.annotations.description,
                details: alert
            });
        });

        res.status(200).json({
            success: true,
            message: 'Operational alerts received',
            processed: alerts.length
        });

    } catch (error) {
        logger.error('Error handling ops alerts', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to process operational alerts'
        });
    }
};

/**
 * Handle infrastructure alerts
 */
exports.handleInfrastructureAlerts = async (req, res) => {
    try {
        const payload = req.body;
        const alerts = processAlertPayload(payload);

        logger.info('Received infrastructure alerts', {
            receiver: payload.receiver,
            status: payload.status,
            alertCount: alerts.length,
            groupLabels: payload.groupLabels
        });

        alerts.forEach(alert => {
            auditLogger.logSecurityEvent({
                action: 'INFRASTRUCTURE_ALERT',
                category: 'infrastructure',
                severity: alert.labels.severity || 'medium',
                alertname: alert.labels.alertname,
                status: alert.status,
                description: alert.annotations.summary || alert.annotations.description,
                details: alert
            });
        });

        // TODO: Add infrastructure-specific actions:
        // - Check if auto-scaling needed
        // - Trigger backup if disk space low
        // - Restart services if needed

        res.status(200).json({
            success: true,
            message: 'Infrastructure alerts received',
            processed: alerts.length
        });

    } catch (error) {
        logger.error('Error handling infrastructure alerts', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to process infrastructure alerts'
        });
    }
};

/**
 * Handle blockchain-related alerts
 */
exports.handleBlockchainAlerts = async (req, res) => {
    try {
        const payload = req.body;
        const alerts = processAlertPayload(payload);

        logger.info('Received blockchain alerts', {
            receiver: payload.receiver,
            status: payload.status,
            alertCount: alerts.length,
            groupLabels: payload.groupLabels
        });

        alerts.forEach(alert => {
            auditLogger.logBlockchainTransaction({
                action: 'BLOCKCHAIN_ALERT',
                severity: alert.labels.severity || 'medium',
                alertname: alert.labels.alertname,
                status: alert.status,
                description: alert.annotations.summary || alert.annotations.description,
                details: alert
            });
        });

        // TODO: Add blockchain-specific actions:
        // - Check chaincode health
        // - Verify peer connectivity
        // - Check transaction backlog

        res.status(200).json({
            success: true,
            message: 'Blockchain alerts received',
            processed: alerts.length
        });

    } catch (error) {
        logger.error('Error handling blockchain alerts', { error: error.message });
        res.status(500).json({
            success: false,
            error: 'Failed to process blockchain alerts'
        });
    }
};
