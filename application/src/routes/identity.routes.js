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
 * /api/v1/identity/register:
 *   post:
 *     summary: Register new user in Keycloak
 *     description: |
 *       Creates a new user in Keycloak IDP. This is the first step of the
 *       registration flow. After registration, user should login to get
 *       access token, then call /enroll to create blockchain identity.
 *     tags: [Identity]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - role
 *             properties:
 *               username:
 *                 type: string
 *                 description: Unique username (3-30 chars, alphanumeric and underscore)
 *               password:
 *                 type: string
 *                 description: Password (minimum 8 characters)
 *               email:
 *                 type: string
 *                 description: User email address
 *               firstName:
 *                 type: string
 *                 description: User first name
 *               lastName:
 *                 type: string
 *                 description: User last name
 *               role:
 *                 type: string
 *                 enum: [producer, pbt_field, pbt_chief, lsm_head]
 *                 description: User role in the system
 *               organization:
 *                 type: string
 *                 description: User organization
 *               phone:
 *                 type: string
 *                 description: Phone number
 *               address:
 *                 type: string
 *                 description: Address
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Username or email already exists
 *       500:
 *         description: Registration failed
 */
router.post('/register',
    identityController.registerUser
);

/**
 * @swagger
 * /api/v1/identity/register-and-enroll:
 *   post:
 *     summary: Register and automatically enroll user
 *     description: |
 *       Combined endpoint that registers user in Keycloak and automatically
 *       enrolls them in Fabric CA. This creates both the IDP identity and
 *       blockchain identity in one step.
 *     tags: [Identity]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - role
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               email:
 *                 type: string
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [producer, pbt_field, pbt_chief, lsm_head]
 *               organization:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered and enrolled successfully
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: Username or email already exists
 *       500:
 *         description: Registration failed
 */
router.post('/register-and-enroll',
    identityController.registerAndEnroll
);

/**
 * @swagger
 * /api/v1/identity/login:
 *   post:
 *     summary: Login and get access token
 *     description: |
 *       Authenticates user and returns Keycloak access token.
 *       Use this token in Authorization header for other API calls.
 *     tags: [Identity]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: number
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Login failed
 */
router.post('/login',
    identityController.login
);

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
