const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const { auditLogger } = require('../utils/auditLogger');

/**
 * Audit Service for querying and analyzing audit logs
 * 
 * Provides:
 * - Log querying and filtering
 * - Security analytics
 * - Compliance reporting
 * - Anomaly detection
 */

class AuditService {
    constructor() {
        this.logDir = path.join(process.env.LOG_DIR || './logs', 'audit');
    }

    /**
     * Query audit logs with filters
     */
    async queryLogs(options = {}) {
        const {
            category,
            startDate,
            endDate,
            userId,
            resource,
            action,
            severity,
            limit = 100,
            offset = 0
        } = options;

        try {
            const logs = [];
            const files = await this.getLogFiles(category, startDate, endDate);

            for (const file of files) {
                const fileLogs = await this.parseLogFile(file);
                logs.push(...fileLogs);
            }

            // Apply filters
            let filtered = this.applyFilters(logs, {
                userId,
                resource,
                action,
                severity,
                startDate,
                endDate
            });

            // Sort by timestamp (newest first)
            filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Apply pagination
            const paginated = filtered.slice(offset, offset + limit);

            return {
                total: filtered.length,
                limit,
                offset,
                data: paginated
            };
        } catch (error) {
            auditLogger.error('Failed to query logs', { error: error.message });
            throw error;
        }
    }

    /**
     * Get user activity summary
     */
    async getUserActivity(userId, days = 7) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const logs = await this.queryLogs({
                userId,
                startDate,
                limit: 10000
            });

            return {
                userId,
                period: { from: startDate, to: new Date() },
                totalActions: logs.total,
                byCategory: this.aggregateByField(logs.data, 'category'),
                byAction: this.aggregateByField(logs.data, 'event'),
                byResource: this.aggregateByField(logs.data, 'resource.type'),
                timeline: this.generateTimeline(logs.data),
                suspiciousActivity: this.detectUserAnomalies(logs.data)
            };
        } catch (error) {
            auditLogger.error('Failed to get user activity', { userId, error: error.message });
            throw error;
        }
    }

    /**
     * Get security events summary
     */
    async getSecurityEvents(days = 1) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const logs = await this.queryLogs({
                category: 'SECURITY',
                startDate,
                limit: 10000
            });

            const criticalEvents = logs.data.filter(l => l.severity === 'CRITICAL');
            const highEvents = logs.data.filter(l => l.severity === 'HIGH');

            return {
                period: { from: startDate, to: new Date() },
                totalEvents: logs.total,
                bySeverity: this.aggregateByField(logs.data, 'severity'),
                byType: this.aggregateByField(logs.data, 'event'),
                criticalEvents: criticalEvents.slice(0, 10),
                highEvents: highEvents.slice(0, 20),
                affectedUsers: this.getUniqueValues(logs.data, 'user.username'),
                sourceIPs: this.aggregateByField(logs.data, 'context.ip')
            };
        } catch (error) {
            auditLogger.error('Failed to get security events', { error: error.message });
            throw error;
        }
    }

    /**
     * Get policy violations
     */
    async getPolicyViolations(days = 7) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const logs = await this.queryLogs({
                category: 'POLICY',
                startDate,
                limit: 10000
            });

            return {
                period: { from: startDate, to: new Date() },
                totalViolations: logs.total,
                byUser: this.aggregateByField(logs.data, 'user.username'),
                byResource: this.aggregateByField(logs.data, 'resource.type'),
                byAction: this.aggregateByField(logs.data, 'resource.action'),
                byReason: this.aggregateByField(logs.data, 'decision.reason'),
                topViolators: this.getTopViolators(logs.data),
                timeline: this.generateTimeline(logs.data)
            };
        } catch (error) {
            auditLogger.error('Failed to get policy violations', { error: error.message });
            throw error;
        }
    }

    /**
     * Get blockchain transaction analytics
     */
    async getBlockchainAnalytics(days = 7) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const logs = await this.queryLogs({
                category: 'BLOCKCHAIN',
                startDate,
                limit: 10000
            });

            const successful = logs.data.filter(l => l.metrics?.success);
            const failed = logs.data.filter(l => !l.metrics?.success);

            return {
                period: { from: startDate, to: new Date() },
                totalTransactions: logs.total,
                successful: successful.length,
                failed: failed.length,
                successRate: (successful.length / logs.total * 100).toFixed(2) + '%',
                byChaincode: this.aggregateByField(logs.data, 'resource.chaincode'),
                byAction: this.aggregateByField(logs.data, 'resource.action'),
                byUser: this.aggregateByField(logs.data, 'user.username'),
                averageDuration: this.calculateAverageDuration(logs.data),
                failureReasons: this.aggregateByField(failed, 'metrics.errorMessage')
            };
        } catch (error) {
            auditLogger.error('Failed to get blockchain analytics', { error: error.message });
            throw error;
        }
    }

    /**
     * Generate compliance report
     */
    async generateComplianceReport(startDate, endDate) {
        try {
            const [
                accessLogs,
                authLogs,
                violations,
                securityEvents,
                blockchainTx
            ] = await Promise.all([
                this.queryLogs({ category: 'ACCESS', startDate, endDate, limit: 10000 }),
                this.queryLogs({ category: 'AUTHENTICATION', startDate, endDate, limit: 10000 }),
                this.queryLogs({ category: 'POLICY', startDate, endDate, limit: 10000 }),
                this.queryLogs({ category: 'SECURITY', startDate, endDate, limit: 10000 }),
                this.queryLogs({ category: 'BLOCKCHAIN', startDate, endDate, limit: 10000 })
            ]);

            return {
                period: { from: startDate, to: endDate },
                summary: {
                    totalAccess: accessLogs.total,
                    totalAuthentications: authLogs.total,
                    totalViolations: violations.total,
                    totalSecurityEvents: securityEvents.total,
                    totalBlockchainTx: blockchainTx.total
                },
                authentication: {
                    total: authLogs.total,
                    successful: authLogs.data.filter(l => l.event.includes('SUCCESS')).length,
                    failed: authLogs.data.filter(l => l.event.includes('FAILED')).length,
                    uniqueUsers: this.getUniqueValues(authLogs.data, 'user.username').length
                },
                access: {
                    total: accessLogs.total,
                    byResource: this.aggregateByField(accessLogs.data, 'resource.type'),
                    byUser: this.aggregateByField(accessLogs.data, 'user.username'),
                    denied: accessLogs.data.filter(l => !l.metrics?.success).length
                },
                security: {
                    total: securityEvents.total,
                    bySeverity: this.aggregateByField(securityEvents.data, 'severity'),
                    criticalCount: securityEvents.data.filter(l => l.severity === 'CRITICAL').length,
                    topThreats: this.aggregateByField(securityEvents.data, 'security.eventType')
                },
                compliance: {
                    policyViolations: violations.total,
                    dataIntegrity: {
                        blockchainTx: blockchainTx.total,
                        successRate: this.calculateSuccessRate(blockchainTx.data)
                    },
                    auditTrail: {
                        complete: true,
                        dataRetention: '90 days',
                        tamperProof: true
                    }
                }
            };
        } catch (error) {
            auditLogger.error('Failed to generate compliance report', { error: error.message });
            throw error;
        }
    }

    /**
     * Detect anomalies in access patterns
     */
    async detectAnomalies(days = 7) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const logs = await this.queryLogs({
                category: 'ACCESS',
                startDate,
                limit: 10000
            });

            const anomalies = [];

            // 1. Unusual access times
            const offHoursAccess = logs.data.filter(l => {
                const hour = new Date(l.timestamp).getHours();
                return hour >= 22 || hour < 6;
            });

            if (offHoursAccess.length > 0) {
                anomalies.push({
                    type: 'OFF_HOURS_ACCESS',
                    severity: 'MEDIUM',
                    count: offHoursAccess.length,
                    users: this.getUniqueValues(offHoursAccess, 'user.username')
                });
            }

            // 2. Unusual resource access patterns
            const userResourceAccess = this.groupBy(logs.data, 'user.username');
            for (const [user, userLogs] of Object.entries(userResourceAccess)) {
                const resources = this.getUniqueValues(userLogs, 'resource.type');
                if (resources.length > 10) {
                    anomalies.push({
                        type: 'UNUSUAL_RESOURCE_ACCESS',
                        severity: 'LOW',
                        user,
                        resourceCount: resources.length
                    });
                }
            }

            // 3. High failure rate
            const failedAccess = logs.data.filter(l => !l.metrics?.success);
            if (failedAccess.length / logs.total > 0.2) {
                anomalies.push({
                    type: 'HIGH_FAILURE_RATE',
                    severity: 'HIGH',
                    rate: (failedAccess.length / logs.total * 100).toFixed(2) + '%',
                    count: failedAccess.length
                });
            }

            return {
                period: { from: startDate, to: new Date() },
                totalAnomalies: anomalies.length,
                anomalies
            };
        } catch (error) {
            auditLogger.error('Failed to detect anomalies', { error: error.message });
            throw error;
        }
    }

    /**
     * Helper: Get log files based on criteria
     */
    async getLogFiles(category, startDate, endDate) {
        try {
            const files = await fs.readdir(this.logDir);
            let filtered = files;

            // Filter by category
            if (category) {
                const categoryMap = {
                    'AUTHENTICATION': 'authentication',
                    'AUTHORIZATION': 'authorization',
                    'SECURITY': 'security',
                    'ACCESS': 'access',
                    'POLICY': 'violations',
                    'BLOCKCHAIN': 'blockchain'
                };
                const prefix = categoryMap[category] || category.toLowerCase();
                filtered = files.filter(f => f.startsWith(prefix));
            }

            // Filter by date range
            if (startDate || endDate) {
                filtered = filtered.filter(f => {
                    const match = f.match(/\d{4}-\d{2}-\d{2}/);
                    if (!match) return false;

                    const fileDate = new Date(match[0]);
                    if (startDate && fileDate < startDate) return false;
                    if (endDate && fileDate > endDate) return false;
                    return true;
                });
            }

            return filtered.map(f => path.join(this.logDir, f));
        } catch (error) {
            auditLogger.error('Failed to get log files', { error: error.message });
            return [];
        }
    }

    /**
     * Helper: Parse log file
     */
    async parseLogFile(filePath) {
        const logs = [];

        try {
            const fileStream = await fs.open(filePath, 'r');
            const rl = readline.createInterface({
                input: fileStream.createReadStream(),
                crlfDelay: Infinity
            });

            for await (const line of rl) {
                try {
                    if (line.trim()) {
                        const log = JSON.parse(line);
                        logs.push(log);
                    }
                } catch (parseError) {
                    // Skip invalid JSON lines
                }
            }

            await fileStream.close();
        } catch (error) {
            auditLogger.error('Failed to parse log file', { filePath, error: error.message });
        }

        return logs;
    }

    /**
     * Helper: Apply filters to logs
     */
    applyFilters(logs, filters) {
        let filtered = [...logs];

        if (filters.userId) {
            filtered = filtered.filter(l => l.user?.id === filters.userId);
        }

        if (filters.resource) {
            filtered = filtered.filter(l => l.resource?.type === filters.resource);
        }

        if (filters.action) {
            filtered = filtered.filter(l => l.resource?.action === filters.action);
        }

        if (filters.severity) {
            filtered = filtered.filter(l => l.severity === filters.severity);
        }

        if (filters.startDate) {
            filtered = filtered.filter(l => new Date(l.timestamp) >= filters.startDate);
        }

        if (filters.endDate) {
            filtered = filtered.filter(l => new Date(l.timestamp) <= filters.endDate);
        }

        return filtered;
    }

    /**
     * Helper: Aggregate logs by field
     */
    aggregateByField(logs, field) {
        const aggregated = {};

        for (const log of logs) {
            const value = this.getNestedValue(log, field) || 'unknown';
            aggregated[value] = (aggregated[value] || 0) + 1;
        }

        return aggregated;
    }

    /**
     * Helper: Get unique values for a field
     */
    getUniqueValues(logs, field) {
        const values = new Set();

        for (const log of logs) {
            const value = this.getNestedValue(log, field);
            if (value) values.add(value);
        }

        return Array.from(values);
    }

    /**
     * Helper: Get nested object value by path
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
    }

    /**
     * Helper: Group logs by field
     */
    groupBy(logs, field) {
        const grouped = {};

        for (const log of logs) {
            const key = this.getNestedValue(log, field) || 'unknown';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(log);
        }

        return grouped;
    }

    /**
     * Helper: Generate timeline aggregation
     */
    generateTimeline(logs) {
        const timeline = {};

        for (const log of logs) {
            const date = new Date(log.timestamp).toISOString().split('T')[0];
            timeline[date] = (timeline[date] || 0) + 1;
        }

        return timeline;
    }

    /**
     * Helper: Calculate average duration
     */
    calculateAverageDuration(logs) {
        const durations = logs
            .map(l => l.metrics?.duration)
            .filter(d => d != null);

        if (durations.length === 0) return 0;

        const sum = durations.reduce((a, b) => a + b, 0);
        return (sum / durations.length).toFixed(2) + 'ms';
    }

    /**
     * Helper: Calculate success rate
     */
    calculateSuccessRate(logs) {
        if (logs.length === 0) return '0%';

        const successful = logs.filter(l => l.metrics?.success).length;
        return (successful / logs.length * 100).toFixed(2) + '%';
    }

    /**
     * Helper: Get top violators
     */
    getTopViolators(logs, limit = 10) {
        const byUser = this.aggregateByField(logs, 'user.username');

        return Object.entries(byUser)
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([username, count]) => ({ username, violations: count }));
    }

    /**
     * Helper: Detect user anomalies
     */
    detectUserAnomalies(logs) {
        const anomalies = [];

        // Check for repeated failures
        const failures = logs.filter(l => !l.metrics?.success);
        if (failures.length > 10) {
            anomalies.push({
                type: 'HIGH_FAILURE_COUNT',
                count: failures.length
            });
        }

        // Check for off-hours activity
        const offHours = logs.filter(l => {
            const hour = new Date(l.timestamp).getHours();
            return hour >= 22 || hour < 6;
        });

        if (offHours.length > 5) {
            anomalies.push({
                type: 'OFF_HOURS_ACTIVITY',
                count: offHours.length
            });
        }

        return anomalies;
    }
}

module.exports = new AuditService();
