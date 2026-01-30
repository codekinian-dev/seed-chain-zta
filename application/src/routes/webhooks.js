/**
 * Webhook Routes
 * Handles incoming webhooks from external services like Prometheus AlertManager
 */

const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');
const { auditLogger } = require('../utils/auditLogger');

/**
 * @route   POST /api/webhooks/alerts
 * @desc    Receive general alerts from AlertManager
 * @access  Public (but should be restricted by firewall/network)
 */
router.post('/alerts', webhookController.handleGeneralAlerts);

/**
 * @route   POST /api/webhooks/security-alerts
 * @desc    Receive security-critical alerts
 * @access  Public (but should be restricted by firewall/network)
 */
router.post('/security-alerts', webhookController.handleSecurityAlerts);

/**
 * @route   POST /api/webhooks/ops-alerts
 * @desc    Receive high-severity operational alerts
 * @access  Public (but should be restricted by firewall/network)
 */
router.post('/ops-alerts', webhookController.handleOpsAlerts);

/**
 * @route   POST /api/webhooks/infrastructure-alerts
 * @desc    Receive infrastructure alerts
 * @access  Public (but should be restricted by firewall/network)
 */
router.post('/infrastructure-alerts', webhookController.handleInfrastructureAlerts);

/**
 * @route   POST /api/webhooks/blockchain-alerts
 * @desc    Receive blockchain-related alerts
 * @access  Public (but should be restricted by firewall/network)
 */
router.post('/blockchain-alerts', webhookController.handleBlockchainAlerts);

/**
 * @route   GET /api/webhooks/health
 * @desc    Health check endpoint for webhook service
 * @access  Public
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'webhook-receiver',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
