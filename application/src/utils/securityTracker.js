const { logSecurityEvent, Severity } = require('../utils/auditLogger');
const auditService = require('../services/auditService');

/**
 * Security Event Tracker and Anomaly Detection
 * 
 * Monitors and detects:
 * - Brute force attacks
 * - Account enumeration
 * - Privilege escalation attempts
 * - Data exfiltration
 * - Unusual access patterns
 * - Zero-day threats
 */

class SecurityTracker {
    constructor() {
        // Track failed login attempts per IP
        this.failedLogins = new Map();

        // Track suspicious IPs
        this.suspiciousIPs = new Set();

        // Track blocked IPs
        this.blockedIPs = new Set();

        // Track user behavior baselines
        this.userBaselines = new Map();

        // Configuration
        this.config = {
            maxFailedLogins: 5,
            failedLoginWindow: 300000, // 5 minutes
            blockDuration: 3600000, // 1 hour
            anomalyThreshold: 0.7,
            rateLimitWindow: 60000, // 1 minute
            rateLimitMax: 100
        };
    }

    /**
     * Track authentication attempt
     */
    trackAuthAttempt(ip, username, success) {
        if (success) {
            // Clear failed attempts on success
            this.clearFailedLogins(ip);
            return { allowed: true };
        }

        // Track failed attempt
        if (!this.failedLogins.has(ip)) {
            this.failedLogins.set(ip, []);
        }

        const attempts = this.failedLogins.get(ip);
        const now = Date.now();

        // Add new attempt
        attempts.push({ timestamp: now, username });

        // Clean old attempts
        const recentAttempts = attempts.filter(
            a => now - a.timestamp < this.config.failedLoginWindow
        );
        this.failedLogins.set(ip, recentAttempts);

        // Check if threshold exceeded
        if (recentAttempts.length >= this.config.maxFailedLogins) {
            this.blockIP(ip, 'BRUTE_FORCE_ATTACK');

            logSecurityEvent(
                'BRUTE_FORCE_DETECTED',
                Severity.CRITICAL,
                { username },
                {
                    ip,
                    attempts: recentAttempts.length,
                    usernames: [...new Set(recentAttempts.map(a => a.username))],
                    description: `Brute force attack detected from IP ${ip}`,
                    response: 'IP_BLOCKED'
                }
            );

            return {
                allowed: false,
                reason: 'Too many failed login attempts. IP blocked.',
                blocked: true
            };
        }

        // Check for account enumeration
        const uniqueUsernames = new Set(recentAttempts.map(a => a.username));
        if (uniqueUsernames.size > 10) {
            this.markSuspicious(ip, 'ACCOUNT_ENUMERATION');

            logSecurityEvent(
                'ACCOUNT_ENUMERATION_DETECTED',
                Severity.HIGH,
                { username },
                {
                    ip,
                    attempts: recentAttempts.length,
                    uniqueUsernames: uniqueUsernames.size,
                    description: `Possible account enumeration from IP ${ip}`,
                    response: 'FLAGGED_AS_SUSPICIOUS'
                }
            );
        }

        return {
            allowed: true,
            warning: `${recentAttempts.length} failed attempts. ${this.config.maxFailedLogins - recentAttempts.length} remaining.`
        };
    }

    /**
     * Track access pattern for anomaly detection
     */
    async trackAccessPattern(user, resource, action, context) {
        const userId = user.id;

        // Build user baseline if not exists
        if (!this.userBaselines.has(userId)) {
            await this.buildUserBaseline(userId);
        }

        const baseline = this.userBaselines.get(userId);
        if (!baseline) {
            return { anomaly: false, score: 0 };
        }

        // Calculate anomaly score
        const anomalyScore = this.calculateAnomalyScore(baseline, {
            resource,
            action,
            hour: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            ip: context.ip
        });

        // Log if anomaly detected
        if (anomalyScore > this.config.anomalyThreshold) {
            logSecurityEvent(
                'ANOMALOUS_ACCESS_PATTERN',
                anomalyScore > 0.9 ? Severity.HIGH : Severity.MEDIUM,
                user,
                {
                    ip: context.ip,
                    resource: resource,
                    action: action,
                    anomalyScore: anomalyScore.toFixed(2),
                    description: `Unusual access pattern detected for user ${user.username}`,
                    indicators: this.getAnomalyIndicators(baseline, {
                        resource, action,
                        hour: new Date().getHours(),
                        ip: context.ip
                    })
                }
            );
        }

        return {
            anomaly: anomalyScore > this.config.anomalyThreshold,
            score: anomalyScore
        };
    }

    /**
     * Detect privilege escalation attempts
     */
    trackPrivilegeEscalation(user, attemptedRole, context) {
        const currentRoles = user.roles || [];

        // Check if user is trying to access higher privileges
        const privilegeHierarchy = {
            'role_producer': 1,
            'role_pbt_field': 2,
            'role_pbt_chief': 3,
            'role_lsm_head': 4
        };

        const userLevel = Math.max(...currentRoles.map(r => privilegeHierarchy[r] || 0));
        const attemptedLevel = privilegeHierarchy[attemptedRole] || 0;

        if (attemptedLevel > userLevel) {
            logSecurityEvent(
                'PRIVILEGE_ESCALATION_ATTEMPT',
                Severity.CRITICAL,
                user,
                {
                    ip: context.ip,
                    userAgent: context.userAgent,
                    currentRoles,
                    attemptedRole,
                    description: `User ${user.username} attempted to escalate privileges`,
                    response: 'DENIED_AND_LOGGED'
                }
            );

            this.markSuspicious(context.ip, 'PRIVILEGE_ESCALATION');

            return {
                allowed: false,
                reason: 'Privilege escalation attempt detected'
            };
        }

        return { allowed: true };
    }

    /**
     * Detect data exfiltration patterns
     */
    trackDataAccess(user, dataSize, context) {
        const userId = user.id;
        const now = Date.now();

        // Track data volume per user
        if (!this.userBaselines.has(userId)) {
            this.userBaselines.set(userId, { dataAccess: [] });
        }

        const baseline = this.userBaselines.get(userId);
        if (!baseline.dataAccess) baseline.dataAccess = [];

        // Add current access
        baseline.dataAccess.push({
            timestamp: now,
            size: dataSize,
            resource: context.resource
        });

        // Calculate volume in last hour
        const hourlyVolume = baseline.dataAccess
            .filter(a => now - a.timestamp < 3600000)
            .reduce((sum, a) => sum + a.size, 0);

        // Alert if excessive data access
        const excessiveThreshold = 100 * 1024 * 1024; // 100MB per hour
        if (hourlyVolume > excessiveThreshold) {
            logSecurityEvent(
                'EXCESSIVE_DATA_ACCESS',
                Severity.HIGH,
                user,
                {
                    ip: context.ip,
                    hourlyVolume: `${(hourlyVolume / 1024 / 1024).toFixed(2)} MB`,
                    description: `Possible data exfiltration by user ${user.username}`,
                    response: 'FLAGGED_FOR_REVIEW'
                }
            );

            return {
                suspicious: true,
                volume: hourlyVolume
            };
        }

        return { suspicious: false, volume: hourlyVolume };
    }

    /**
     * Check if IP is blocked
     */
    isBlocked(ip) {
        return this.blockedIPs.has(ip);
    }

    /**
     * Check if IP is suspicious
     */
    isSuspicious(ip) {
        return this.suspiciousIPs.has(ip);
    }

    /**
     * Block IP address
     */
    blockIP(ip, reason) {
        this.blockedIPs.add(ip);
        this.suspiciousIPs.add(ip);

        // Auto-unblock after duration
        setTimeout(() => {
            this.blockedIPs.delete(ip);
        }, this.config.blockDuration);

        logSecurityEvent(
            'IP_BLOCKED',
            Severity.CRITICAL,
            { username: 'system' },
            {
                ip,
                reason,
                duration: this.config.blockDuration / 1000 / 60 + ' minutes',
                description: `IP ${ip} blocked due to ${reason}`
            }
        );
    }

    /**
     * Mark IP as suspicious
     */
    markSuspicious(ip, reason) {
        this.suspiciousIPs.add(ip);

        logSecurityEvent(
            'IP_MARKED_SUSPICIOUS',
            Severity.MEDIUM,
            { username: 'system' },
            {
                ip,
                reason,
                description: `IP ${ip} marked as suspicious: ${reason}`
            }
        );
    }

    /**
     * Clear failed login attempts
     */
    clearFailedLogins(ip) {
        this.failedLogins.delete(ip);
    }

    /**
     * Build user behavior baseline
     */
    async buildUserBaseline(userId) {
        try {
            // Get user activity from last 30 days
            const activity = await auditService.getUserActivity(userId, 30);

            const baseline = {
                userId,
                commonResources: this.extractTopItems(activity.byResource, 5),
                commonActions: this.extractTopItems(activity.byAction, 5),
                commonHours: this.extractCommonHours(activity.timeline),
                commonIPs: [],
                lastUpdated: new Date()
            };

            this.userBaselines.set(userId, baseline);
            return baseline;
        } catch (error) {
            console.error('Failed to build user baseline:', error);
            return null;
        }
    }

    /**
     * Calculate anomaly score (0-1)
     */
    calculateAnomalyScore(baseline, current) {
        let score = 0;
        let factors = 0;

        // Check resource
        if (!baseline.commonResources.includes(current.resource)) {
            score += 0.3;
        }
        factors++;

        // Check action
        if (!baseline.commonActions.includes(current.action)) {
            score += 0.2;
        }
        factors++;

        // Check time
        if (!baseline.commonHours.includes(current.hour)) {
            score += 0.3;
        }
        factors++;

        // Check IP (if available)
        if (baseline.commonIPs.length > 0 && !baseline.commonIPs.includes(current.ip)) {
            score += 0.2;
        }
        factors++;

        return score / factors;
    }

    /**
     * Get anomaly indicators
     */
    getAnomalyIndicators(baseline, current) {
        const indicators = [];

        if (!baseline.commonResources.includes(current.resource)) {
            indicators.push('UNUSUAL_RESOURCE');
        }

        if (!baseline.commonActions.includes(current.action)) {
            indicators.push('UNUSUAL_ACTION');
        }

        if (!baseline.commonHours.includes(current.hour)) {
            indicators.push('UNUSUAL_TIME');
        }

        if (baseline.commonIPs.length > 0 && !baseline.commonIPs.includes(current.ip)) {
            indicators.push('UNUSUAL_IP');
        }

        return indicators;
    }

    /**
     * Extract top items from aggregated data
     */
    extractTopItems(data, limit) {
        return Object.entries(data)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([key]) => key);
    }

    /**
     * Extract common hours from timeline
     */
    extractCommonHours(timeline) {
        const hourCounts = {};

        for (const [date, count] of Object.entries(timeline)) {
            const hour = new Date(date).getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + count;
        }

        return Object.entries(hourCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([hour]) => parseInt(hour));
    }

    /**
     * Get security statistics
     */
    getStatistics() {
        return {
            blockedIPs: this.blockedIPs.size,
            suspiciousIPs: this.suspiciousIPs.size,
            trackedUsers: this.userBaselines.size,
            failedLoginAttempts: Array.from(this.failedLogins.values())
                .reduce((sum, attempts) => sum + attempts.length, 0)
        };
    }

    /**
     * Reset tracking data (for testing)
     */
    reset() {
        this.failedLogins.clear();
        this.suspiciousIPs.clear();
        this.blockedIPs.clear();
        this.userBaselines.clear();
    }
}

// Export singleton instance
module.exports = new SecurityTracker();
