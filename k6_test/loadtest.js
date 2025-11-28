import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Counter, Trend } from 'k6/metrics';
import { FormData } from 'https://jslib.k6.io/formdata/0.0.2/index.js';
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// Custom metrics
const errorRate = new Rate('errors');
const seedBatchCreated = new Counter('seed_batch_created');
const seedBatchFailed = new Counter('seed_batch_failed');
const seedBatchDuration = new Trend('seed_batch_duration');

// Load PDF file once at init stage (global scope)
const pdfFile = open('./documents/test.pdf', 'b');

// K6 options - Load test configuration
export const options = {
    stages: [
        { duration: '30s', target: 5 },   // Baseline: 5 users
        { duration: '60s', target: 5 },   // Stay at baseline (5 users)
        { duration: '30s', target: 50 },  // Stress test: ramp to 50 users
        { duration: '60s', target: 50 },  // Stay at stress level (50 users)
        { duration: '10s', target: 0 },   // Ramp down to 0
    ],
    thresholds: {
        'http_req_duration': ['p(95)<10000'], // 95% of requests must complete below 10s (blockchain + file upload)
        'seed_batch_duration': ['p(95)<10000'], // Seed batch creation under 10s
        'errors': ['rate<0.1'],                 // Error rate must be less than 10%
        'http_req_failed': ['rate<0.05'],       // HTTP errors must be less than 5%
    },
};

// Keycloak and API configuration
const KEYCLOAK_URL = 'https://auth.jabarchain.me';
const KEYCLOAK_REALM = 'SeedCertificationRealm';
const KEYCLOAK_CLIENT_ID = 'seed-cert-frontend'; // Public client - no secret required
const API_BASE_URL = 'https://gateway.jabarchain.me';

// Multiple test user credentials for concurrent load testing
// Each VU will use a different user to avoid session conflicts
const TEST_USERS = [
    { username: 'producer_test', password: 'Test123!' },
    { username: 'producer_test2', password: 'Test123!' },
    { username: 'producer_test3', password: 'Test123!' },
    { username: 'producer_test4', password: 'Test123!' },
    { username: 'producer_test5', password: 'Test123!' },
];

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
 * Generate dummy seed batch data
 */
function generateSeedBatchData(iteration) {
    const timestamp = Date.now();
    const commodities = ['Karet', 'Sawit', 'Kakao', 'Kopi', 'Teh'];
    const varieties = ['Varietas A', 'Varietas B', 'Varietas C', 'Varietas Super', 'Varietas Unggul'];
    const origins = ['Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Sumatera Utara', 'Kalimantan'];
    const seedClasses = ['BS', 'BD', 'BP', 'BR']; // Valid seed class codes

    return {
        varietyName: varieties[iteration % varieties.length],
        commodity: commodities[iteration % commodities.length],
        harvestDate: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        seedSourceNumber: `SRC-${timestamp}-${iteration}`,
        origin: origins[iteration % origins.length],
        iupNumber: `IUP-${timestamp}-${Math.floor(Math.random() * 10000)}`,
        seedClass: seedClasses[iteration % seedClasses.length]
    };
}

/**
 * Main test scenario
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

    // Step 2: Create seed batch using standard endpoint with file upload
    const iteration = __ITER;
    const seedData = generateSeedBatchData(iteration);

    const createUrl = `${API_BASE_URL}/api/seed-batches`;

    // Create multipart form data
    const formData = new FormData();
    formData.append('varietyName', seedData.varietyName);
    formData.append('commodity', seedData.commodity);
    formData.append('harvestDate', seedData.harvestDate);
    formData.append('seedSourceNumber', seedData.seedSourceNumber);
    formData.append('origin', seedData.origin);
    formData.append('iupNumber', seedData.iupNumber);
    formData.append('seedClass', seedData.seedClass);
    formData.append('document', http.file(pdfFile, 'test.pdf', 'application/pdf'));

    const params = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data; boundary=' + formData.boundary,
        },
        tags: { name: 'CreateSeedBatch' },
    };

    const response = http.post(createUrl, formData.body(), params);

    // Record response time for seed batch creation
    seedBatchDuration.add(response.timings.duration);

    // Validate response
    const checkRes = check(response, {
        'Create seed batch - status 200 or 201': (r) => r.status === 200 || r.status === 201,
        'Create seed batch - has success field': (r) => {
            try {
                return r.json('success') !== undefined;
            } catch (e) {
                return false;
            }
        },
    });

    // Check if request was successful (status 200 or 201)
    const isSuccess = response.status === 200 || response.status === 201;

    if (!isSuccess) {
        const errorBody = response.body ? String(response.body).substring(0, 500) : 'No response body';
        console.error(`Create seed batch failed: ${response.status} - ${errorBody}`);
        errorRate.add(1);
        seedBatchFailed.add(1);
    } else {
        errorRate.add(0);
        seedBatchCreated.add(1);
        // Log successful request
        if (__ITER % 10 === 0) {
            console.log(`✓ Iteration ${__ITER}: Seed batch created successfully`);
        }
    }

    // Think time - simulate real user behavior and avoid rate limiting
    sleep(Math.random() * 3 + 2); // Random sleep between 2-5 seconds to avoid 429 errors
}

/**
 * Setup function - runs once before test
 */
export function setup() {
    console.log('=== K6 Load Test Setup ===');
    console.log(`Target: 50 Virtual Users`);
    console.log(`Duration: 30 seconds at peak`);
    console.log(`Keycloak: ${KEYCLOAK_URL}`);
    console.log(`API: ${API_BASE_URL}`);
    console.log('==========================');

    return {};
}

/**
 * Teardown function - runs once after test
 */
export function teardown(data) {
    console.log('=== K6 Load Test Completed ===');
}

/**
 * Handle Summary - Generate HTML report with timestamp
 */
export function handleSummary(data) {
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/T/, '_')
        .replace(/:/g, '-')
        .replace(/\..+/, ''); // Format: 2025-11-28_14-30-45

    return {
        [`reports/report-${timestamp}.html`]: htmlReport(data),
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}
