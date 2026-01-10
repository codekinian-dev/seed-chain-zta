/**
 * Identity Routes
 * 
 * Routes for managing user identities (Fabric CA enrollment)
 */

const express = require('express');
const router = express.Router();
const identityController = require('../controllers/identity.controller');
const { keycloak } = require('../middleware/auth');

/**
 * @swagger
 * /api/v1/identity/enroll:
 *   post:
 *     summary: Enroll user identity in Fabric CA
 *     description: |
 *       Registers the authenticated user with Fabric CA and creates wallet identity.
 *       Should be called after user registers/logs in via Keycloak.
 *       The CA will generate a private key and certificate for the user.
 *     tags: [Identity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: User enrolled successfully
 *       200:
 *         description: User identity already exists
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Enrollment failed
 */
router.post('/enroll',
    keycloak.protect(),
    identityController.enrollUser
);

/**
 * @swagger
 * /api/v1/identity/status:
 *   get:
 *     summary: Check user identity status
 *     description: Check if the authenticated user has a Fabric identity
 *     tags: [Identity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Identity status retrieved
 *       401:
 *         description: Unauthorized
 */
router.get('/status',
    keycloak.protect(),
    identityController.checkIdentityStatus
);

/**
 * @swagger
 * /api/v1/identity/reenroll:
 *   post:
 *     summary: Re-enroll user identity
 *     description: Refresh the user's certificate (re-enrollment)
 *     tags: [Identity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Re-enrollment successful
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Re-enrollment failed
 */
router.post('/reenroll',
    keycloak.protect(),
    identityController.reenrollUser
);

/**
 * @swagger
 * /api/v1/identity/list:
 *   get:
 *     summary: List all identities (admin only)
 *     description: List all user identities in the wallet
 *     tags: [Identity]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of identities
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin role required
 */
router.get('/list',
    keycloak.protect(),
    identityController.listIdentities
);

/**
 * @swagger
 * /api/v1/identity/{userId}:
 *   delete:
 *     summary: Revoke user identity (admin only)
 *     description: Revoke a user's Fabric identity
 *     tags: [Identity]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID (Keycloak UUID)
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for revocation
 *     responses:
 *       200:
 *         description: Identity revoked
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin role required
 */
router.delete('/:userId',
    keycloak.protect(),
    identityController.revokeUser
);

module.exports = router;
