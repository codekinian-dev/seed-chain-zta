const session = require('express-session');
const Keycloak = require('keycloak-connect');
const logger = require('../utils/logger');

// Try to load Redis dependencies
let RedisStore, createClient;
try {
    const connectRedis = require('connect-redis');
    RedisStore = connectRedis.default || connectRedis;
    const redisModule = require('redis');
    createClient = redisModule.createClient;
} catch (error) {
    logger.warn('[Auth] Redis packages not available:', error.message);
}

// Redis client for session store
let redisClient;
let sessionStore;

// Try to connect to Redis, fallback to MemoryStore if unavailable
const initializeSessionStore = async () => {
    // If Redis dependencies not available, use MemoryStore
    if (!RedisStore || !createClient) {
        logger.warn('[Auth] Redis dependencies not installed, using MemoryStore');
        logger.warn('[Auth] ⚠️  MemoryStore is not suitable for production!');
        sessionStore = new session.MemoryStore();
        return sessionStore;
    }

    try {
        const redisHost = process.env.REDIS_HOST || 'localhost';
        const redisPort = process.env.REDIS_PORT || 6379;

        redisClient = createClient({
            socket: {
                host: redisHost,
                port: redisPort,
                connectTimeout: 5000
            },
            legacyMode: false
        });

        redisClient.on('error', (err) => {
            logger.warn('[Auth] Redis client error:', err.message);
        });

        redisClient.on('connect', () => {
            logger.info('[Auth] Redis session store connected');
        });

        await redisClient.connect();

        sessionStore = new RedisStore({
            client: redisClient,
            prefix: 'sess:',
            ttl: 86400 // 24 hours
        });

        logger.info('[Auth] Using Redis session store');
        return sessionStore;

    } catch (error) {
        logger.warn('[Auth] Redis not available, falling back to MemoryStore:', error.message);
        logger.warn('[Auth] ⚠️  MemoryStore is not suitable for production!');
        sessionStore = new session.MemoryStore();
        return sessionStore;
    }
};// Session middleware (will be initialized async)
let sessionMiddleware;

const getSessionMiddleware = () => {
    if (!sessionMiddleware) {
        throw new Error('Session middleware not initialized. Call initializeSessionStore first.');
    }
    return sessionMiddleware;
};

// Initialize session with store
const createSessionMiddleware = (store) => {
    // Suppress MemoryStore warning if using fallback
    // (We already log our own warning)
    const originalWarn = console.warn;
    const suppressedWarnings = [];

    console.warn = (...args) => {
        const msg = args.join(' ');
        if (msg.includes('MemoryStore') && msg.includes('production environment')) {
            // Suppress this specific warning (we handle it ourselves)
            return;
        }
        originalWarn.apply(console, args);
    };

    const middleware = session({
        store: store,
        secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            maxAge: 1000 * 60 * 60 * 24 // 24 hours
        }
    });

    // Restore original console.warn
    console.warn = originalWarn;

    return middleware;
};

// Keycloak configuration
const keycloakConfig = {
    realm: process.env.KEYCLOAK_REALM || 'SeedCertificationRealm',
    'auth-server-url': process.env.KEYCLOAK_URL || 'http://localhost:8080',
    'ssl-required': 'external',
    resource: process.env.KEYCLOAK_CLIENT_ID || 'seed-api-gateway',
    'public-client': false,
    'confidential-port': 0,
    credentials: {
        secret: process.env.KEYCLOAK_CLIENT_SECRET
    },
    'bearer-only': true
};

// Keycloak instance (will be initialized with session store)
let keycloak;

/**
 * Custom protect middleware with better error logging
 */
const protect = () => {
    return (req, res, next) => {
        // Log authentication attempt
        logger.info('[Auth] Authentication attempt', {
            path: req.path,
            method: req.method,
            hasToken: !!req.headers.authorization
        });

        // Check if keycloak is initialized
        if (!keycloak) {
            logger.error('[Auth] Keycloak not initialized');
            return res.status(500).json({
                error: 'Internal Server Error',
                message: 'Authentication service not initialized'
            });
        }

        // Use keycloak's built-in protect
        return keycloak.protect()(req, res, (err) => {
            if (err) {
                logger.error('[Auth] Keycloak protect error', {
                    error: err.message,
                    stack: err.stack,
                    path: req.path
                });
                return res.status(403).json({
                    error: 'Forbidden',
                    message: 'Authentication failed'
                });
            }

            // Log successful authentication
            if (req.kauth && req.kauth.grant) {
                const token = req.kauth.grant.access_token;
                logger.info('[Auth] Authentication successful', {
                    path: req.path,
                    userId: token.content.sub,
                    username: token.content.preferred_username,
                    roles: token.content.realm_access?.roles || []
                });
            }

            next();
        });
    };
};

/**
 * Middleware to require specific role(s)
 * @param {Array<string>|string} roles - Required role(s)
 */
const requireRole = (roles) => {
    const roleArray = Array.isArray(roles) ? roles : [roles];

    return (req, res, next) => {
        if (!req.kauth || !req.kauth.grant) {
            logger.security('UNAUTHORIZED_ACCESS', null, {
                path: req.path,
                reason: 'No valid grant'
            });
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        }

        const token = req.kauth.grant.access_token;
        const userRoles = token.content.realm_access?.roles || [];
        const userId = token.content.sub;
        const username = token.content.preferred_username;

        // Check if user has at least one required role
        const hasRequiredRole = roleArray.some(role => userRoles.includes(role));

        if (!hasRequiredRole) {
            logger.security('ROLE_ACCESS_DENIED', userId, {
                username,
                requiredRoles: roleArray,
                userRoles,
                path: req.path
            });

            return res.status(403).json({
                error: 'Forbidden',
                message: `Access denied. Required role(s): ${roleArray.join(', ')}`
            });
        }

        // Attach user info to request
        req.user = {
            id: userId,
            username,
            roles: userRoles,
            email: token.content.email,
            fullName: token.content.name
        };

        logger.audit('ROLE_ACCESS_GRANTED', userId, req.path, {
            username,
            role: roleArray.find(r => userRoles.includes(r)),
            method: req.method
        });

        next();
    };
};

/**
 * Extract user info from token (for public routes that optionally check auth)
 */
const optionalAuth = (req, res, next) => {
    if (req.kauth && req.kauth.grant) {
        const token = req.kauth.grant.access_token;
        req.user = {
            id: token.content.sub,
            username: token.content.preferred_username,
            roles: token.content.realm_access?.roles || [],
            email: token.content.email,
            fullName: token.content.name
        };
    }
    next();
};

/**
 * Middleware to log all authentication attempts
 */
const logAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        logger.info('[Auth] Authentication attempt', {
            path: req.path,
            method: req.method,
            hasToken: !!authHeader
        });
    }

    next();
};

/**
 * Get user UUID from token (for chaincode operations)
 */
const getUserUUID = (req) => {
    console.log('=== getUserUUID DEBUG ===');
    console.log('Has kauth:', !!req.kauth);
    console.log('Has grant:', !!(req.kauth && req.kauth.grant));

    // Try req.kauth.grant (after keycloak.protect())
    if (req.kauth && req.kauth.grant) {
        const token = req.kauth.grant.access_token;
        console.log('Has token:', !!token);
        console.log('Has token.content:', !!(token && token.content));

        if (token && token.content) {
            const content = token.content;
            console.log('Token sub:', content.sub);
            console.log('Token sid:', content.sid);
            console.log('Token jti:', content.jti);

            // Try multiple sources for user identifier
            // 1. Standard 'sub' claim (user UUID)
            if (content.sub) {
                return content.sub;
            }

            // 2. Session ID - unique per user session
            if (content.sid) {
                return content.sid;
            }

            // 3. JWT ID - fallback (extract UUID part after colon)
            if (content.jti) {
                const jtiParts = content.jti.split(':');
                return jtiParts.length > 1 ? jtiParts[1] : content.jti;
            }

            // 4. Preferred username
            if (content.preferred_username) {
                return content.preferred_username;
            }
        }
    }

    // Fallback: Try to extract from Authorization header directly
    const authHeader = req.headers.authorization;
    console.log('Has auth header:', !!authHeader);

    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.substring(7);
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            console.log('Decoded payload sub:', payload.sub);
            return payload.sub || payload.sid || payload.user_id || payload.preferred_username || null;
        } catch (error) {
            console.log('Error decoding token:', error.message);
            return null;
        }
    }

    console.log('No UUID found');
    return null;
};/**
 * Check if user has specific role
 */
const hasRole = (req, role) => {
    if (!req.user || !req.user.roles) {
        return false;
    }
    return req.user.roles.includes(role);
};

/**
 * Initialize auth middleware with session store
 * Must be called before using sessionMiddleware or keycloak
 */
const initializeAuth = async () => {
    const store = await initializeSessionStore();
    sessionMiddleware = createSessionMiddleware(store);
    keycloak = new Keycloak({ store }, keycloakConfig);
    logger.info('[Auth] Authentication middleware initialized');
};

module.exports = {
    initializeAuth,
    getSessionMiddleware,
    get sessionMiddleware() {
        return getSessionMiddleware();
    },
    get keycloak() {
        if (!keycloak) {
            throw new Error('Keycloak not initialized. Call initializeAuth first.');
        }
        return keycloak;
    },
    protect,
    requireRole,
    optionalAuth,
    logAuth,
    getUserUUID,
    hasRole
};
