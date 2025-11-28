import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// Custom metrics
const errorRate = new Rate('errors');
const querySuccess = new Counter('query_success');
const queryFailed = new Counter('query_failed');
const queryDuration = new Trend('query_duration');
const queryNotFound = new Counter('query_not_found');

// K6 options - Query test configuration
export const options = {
    stages: [
        { duration: '30s', target: 10 },   // Ramp up to 10 users
        { duration: '1m', target: 10 },    // Stay at 10 users
        { duration: '30s', target: 30 },   // Ramp up to 30 users
        { duration: '1m', target: 30 },    // Stay at 30 users
        { duration: '30s', target: 50 },   // Ramp up to 50 users
        { duration: '1m', target: 50 },    // Stay at 50 users
        { duration: '30s', target: 0 },    // Ramp down
    ],
    thresholds: {
        'http_req_duration': ['p(95)<2000'],  // 95% of requests must complete below 2s (query is fast)
        'query_duration': ['p(95)<2000'],     // Query duration under 2s
        'errors': ['rate<0.1'],               // Error rate must be less than 10%
        'http_req_failed': ['rate<0.1'],      // HTTP errors must be less than 10%
    },
};

// Keycloak and API configuration
const KEYCLOAK_URL = 'https://auth.jabarchain.me';
const KEYCLOAK_REALM = 'SeedCertificationRealm';
const KEYCLOAK_CLIENT_ID = 'seed-cert-frontend'; // Public client - no secret required
const API_BASE_URL = 'https://gateway.jabarchain.me';

// Multiple test user credentials for concurrent load testing
// Each VU will use a different user to avoid session conflicts
const TEST_USERS = Array.from({ length: 49 }, (_, i) => ({
    username: `producer_test${i + 1}`,
    password: 'Test123!',
}));

/**
 * Get access token from Keycloak
 */
function getAccessToken(userIndex) {
    // Select user based on VU ID to distribute load across multiple users
    const user = TEST_USERS[userIndex % TEST_USERS.length];

    const tokenUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;

    const payload = {
        grant_type: 'password',
        client_id: KEYCLOAK_CLIENT_ID,
        username: user.username,
        password: user.password,
    };

    const params = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    };

    const response = http.post(tokenUrl, payload, params);

    const checkRes = check(response, {
        'Keycloak login successful': (r) => r.status === 200,
        'Access token received': (r) => r.json('access_token') !== undefined,
    });

    if (!checkRes) {
        console.error(`Keycloak login failed for ${user.username}: ${response.status} - ${response.body}`);
        errorRate.add(1);
        return null;
    }

    return response.json('access_token');
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
    console.log(`Target: Max 50 Virtual Users`);
    console.log(`Duration: ~5.5 minutes total`);
    console.log(`Query Range: batch-1 to batch-5000`);
    console.log(`Keycloak: ${KEYCLOAK_URL}`);
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
 * Handle Summary - Generate HTML report with timestamp
 */
export function handleSummary(data) {
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/T/, '_')
        .replace(/:/g, '-')
        .replace(/\..+/, ''); // Format: 2025-11-29_14-30-45

    return {
        [`reports/query-report-${timestamp}.html`]: htmlReport(data),
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}
