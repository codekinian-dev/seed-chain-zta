import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// Custom metrics
const errorRate = new Rate('errors');
const querySuccess = new Counter('query_success');
const queryFailed = new Counter('query_failed');
const queryDuration = new Trend('query_duration');
const queryNotFound = new Counter('query_not_found');

// K6 options - Query test configuration (reduced VUs to prevent OOM)
export const options = {
    stages: [
        { duration: '30s', target: 5 },   // Ramp up to 5 users
        { duration: '1m', target: 5 },    // Stay at 5 users
        { duration: '30s', target: 10 },  // Ramp up to 10 users
        { duration: '1m', target: 10 },   // Stay at 10 users
        { duration: '30s', target: 0 },   // Ramp down
    ],
    thresholds: {
        'http_req_duration': ['p(95)<2000'],  // 95% of requests must complete below 2s (query is fast)
        'query_duration': ['p(95)<2000'],     // Query duration under 2s
        'errors': ['rate<0.1'],               // Error rate must be less than 10%
        'http_req_failed': ['rate<0.1'],      // HTTP errors must be less than 10%
    },
};

// API configuration
const API_BASE_URL = 'https://gateway.jabarchain.me';

// Test user credentials from query_result.csv
// These users are registered via setup-test-users.sh
const TEST_USERS = [
    { username: '1E1DFC06', password: 'Test123!' },
    { username: '46FC9A16', password: 'Test123!' },
    { username: 'B59D7AAB', password: 'Test123!' },
    { username: 'C258D1E8', password: 'Test123!' },
    { username: 'E9C38C5C', password: 'Test123!' },
    { username: '812E38B8', password: 'Test123!' },
    { username: 'FA076AF8', password: 'Test123!' },
    { username: '0604DE6E', password: 'Test123!' },
    { username: '3595C469', password: 'Test123!' },
    { username: '7BF8E819', password: 'Test123!' },
    { username: '0E540A27', password: 'Test123!' },
    { username: 'BF785D7D', password: 'Test123!' },
    { username: 'CC562ABD', password: 'Test123!' },
    { username: '51E748FE', password: 'Test123!' },
    { username: '63AF1539', password: 'Test123!' },
    { username: 'A1B9FEBB', password: 'Test123!' },
    { username: 'kpri_rati', password: 'Test123!' },
    { username: '28CF0230', password: 'Test123!' },
    { username: '91420A44', password: 'Test123!' },
    { username: '5089220F', password: 'Test123!' },
    { username: 'C362EC88', password: 'Test123!' },
    { username: 'B9741EC8', password: 'Test123!' },
    { username: '1ECD114C', password: 'Test123!' },
    { username: '7DCF7CA4', password: 'Test123!' },
    { username: '1A6A8FD7', password: 'Test123!' },
    { username: '48CA8C6A', password: 'Test123!' },
    { username: 'DC6629E6', password: 'Test123!' },
    { username: '1E845C34', password: 'Test123!' },
    { username: 'F3376F5A', password: 'Test123!' },
];

/**
 * Get access token via Gateway Login API
 */
function getAccessToken(userIndex) {
    // Select user based on VU ID to distribute load across multiple users
    const user = TEST_USERS[userIndex % TEST_USERS.length];

    const loginUrl = `${API_BASE_URL}/api/v1/identity/login`;

    const payload = JSON.stringify({
        username: user.username,
        password: user.password,
    });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
    };

    const response = http.post(loginUrl, payload, params);

    const checkRes = check(response, {
        'Gateway login successful': (r) => r.status === 200,
        'Access token received': (r) => {
            try {
                const body = r.json();
                return body.success === true && body.data?.accessToken !== undefined;
            } catch (e) {
                return false;
            }
        },
    });

    if (!checkRes) {
        console.error(`Gateway login failed for ${user.username}: ${response.status} - ${response.body}`);
        errorRate.add(1);
        return null;
    }

    return response.json('data').accessToken;
}

/**
 * Generate random batch ID from batch-1 to batch-5000
 */
function getRandomBatchId() {
    const batchNumber = Math.floor(Math.random() * 500) + 1;
    return `BATCH-${batchNumber}`;
}

/**
 * Main test scenario - Query seed batch by ID
 */
export default function () {
    // Step 1: Get access token using VU ID for user distribution
    const vuId = __VU; // Virtual User ID (1-based)
    const token = getAccessToken(vuId);

    if (!token) {
        errorRate.add(1);
        sleep(1);
        return;
    }

    // Step 2: Query random seed batch by ID
    const batchId = getRandomBatchId();
    const queryUrl = `${API_BASE_URL}/api/seed-batches/${batchId}`;

    const params = {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        tags: { name: 'QuerySeedBatch' },
    };

    const response = http.get(queryUrl, params);

    // Record response time for query
    queryDuration.add(response.timings.duration);

    // Validate response
    const checkRes = check(response, {
        'Query seed batch - status 200 or 404': (r) => r.status === 200 || r.status === 404,
        'Query seed batch - valid response': (r) => {
            try {
                const body = r.json();
                return body !== undefined;
            } catch (e) {
                return false;
            }
        },
    });

    // Check response status
    if (response.status === 200) {
        querySuccess.add(1);
        errorRate.add(0);
        // Log successful query every 10 iterations
        if (__ITER % 10 === 0) {
            console.log(`✓ Iteration ${__ITER}: Query ${batchId} - Found`);
        }
    } else if (response.status === 404) {
        queryNotFound.add(1);
        errorRate.add(0);
        // Not found is acceptable for random query
        if (__ITER % 20 === 0) {
            console.log(`ℹ Iteration ${__ITER}: Query ${batchId} - Not Found (404)`);
        }
    } else {
        queryFailed.add(1);
        errorRate.add(1);
        const errorBody = response.body ? String(response.body).substring(0, 300) : 'No response body';
        console.error(`Query failed for ${batchId}: ${response.status} - ${errorBody}`);
    }

    // Think time - simulate real user behavior (query is faster than create)
    sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

/**
 * Setup function - runs once before test
 */
export function setup() {
    console.log('=== K6 Query Test Setup ===');
    console.log(`Target: Max 10 Virtual Users`);
    console.log(`Duration: ~3.5 minutes total`);
    console.log(`Query Range: batch-1 to batch-5000`);
    console.log(`API: ${API_BASE_URL}`);
    console.log('===========================');

    return {};
}

/**
 * Teardown function - runs once after test
 */
export function teardown(data) {
    console.log('=== K6 Query Test Completed ===');
}

/**
 * Handle Summary - Generate HTML and CSV reports with timestamp
 */
export function handleSummary(data) {
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/T/, '_')
        .replace(/:/g, '-')
        .replace(/\..*/, ''); // Format: 2025-11-29_14-30-45

    // Extract metrics for CSV
    const httpReqDuration = data.metrics.http_req_duration || {};
    const queryDurationMetric = data.metrics.query_duration || {};
    const httpReqs = data.metrics.http_reqs || {};

    // Calculate metrics
    const avgResponseTime = httpReqDuration.values?.avg || 0;
    const p95ResponseTime = httpReqDuration.values?.['p(95)'] || 0;
    const p99ResponseTime = httpReqDuration.values?.['p(99)'] || 0;
    const minResponseTime = httpReqDuration.values?.min || 0;
    const maxResponseTime = httpReqDuration.values?.max || 0;
    const medResponseTime = httpReqDuration.values?.med || 0;

    // Throughput (RPS) = total requests / total duration in seconds
    const totalRequests = httpReqs.values?.count || 0;
    const testDuration = (data.state?.testRunDurationMs || 390000) / 1000; // default ~6.5 min
    const throughputRPS = totalRequests / testDuration;

    // Overhead calculation (difference between total response time and actual processing)
    // Using p95 - median as a proxy for overhead/variability
    const overhead = p95ResponseTime - medResponseTime;

    // Query specific metrics
    const queryAvg = queryDurationMetric.values?.avg || 0;
    const queryP95 = queryDurationMetric.values?.['p(95)'] || 0;

    // Get success/failure counts
    const querySuccessCount = data.metrics.query_success?.values?.count || 0;
    const queryFailedCount = data.metrics.query_failed?.values?.count || 0;
    const queryNotFoundCount = data.metrics.query_not_found?.values?.count || 0;
    const errorRateValue = data.metrics.errors?.values?.rate || 0;

    // CSV Header and Data
    const csvHeader = 'Timestamp,Test_Type,Total_Requests,Success_Count,Failed_Count,NotFound_Count,Error_Rate_Percent,Avg_Response_Time_ms,Med_Response_Time_ms,P95_Response_Time_ms,P99_Response_Time_ms,Min_Response_Time_ms,Max_Response_Time_ms,Throughput_RPS,Overhead_ms,Query_Avg_ms,Query_P95_ms,Test_Duration_sec';
    const csvData = `${now.toISOString()},QuerySeedBatch,${totalRequests},${querySuccessCount},${queryFailedCount},${queryNotFoundCount},${(errorRateValue * 100).toFixed(2)},${avgResponseTime.toFixed(2)},${medResponseTime.toFixed(2)},${p95ResponseTime.toFixed(2)},${p99ResponseTime.toFixed(2)},${minResponseTime.toFixed(2)},${maxResponseTime.toFixed(2)},${throughputRPS.toFixed(4)},${overhead.toFixed(2)},${queryAvg.toFixed(2)},${queryP95.toFixed(2)},${testDuration.toFixed(2)}`;
    const csvContent = `${csvHeader}\n${csvData}`;

    return {
        [`reports/query-report-${timestamp}.csv`]: csvContent,
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}
