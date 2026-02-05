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

// Load seed batch dataset from JSON file
const seedBatchDataset = new SharedArray('seedBatchData', function () {
    return JSON.parse(open('./documents/seed-batch-dataset.json'));
});

// K6 options - Load test configuration
export const options = {
    stages: [
        { duration: '1m', target: 20 },   // Ramp up to 20 users
        { duration: '2m', target: 20 },   // Stay at 20 users
        { duration: '1m', target: 50 },   // Ramp up to 50 users
        { duration: '2m', target: 50 },   // Stay at 50 users
        { duration: '30s', target: 0 },   // Ramp down
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
 * Get seed batch data from dataset
 * Uses modulo to cycle through dataset entries
 */
function getSeedBatchData(iteration) {
    const timestamp = Date.now();
    const dataIndex = iteration % seedBatchDataset.length;
    const baseData = seedBatchDataset[dataIndex];

    // Map dataset fields to API expected fields
    // Add unique suffix to seedSourceNumber to avoid duplicates
    return {
        varietyName: baseData.variety,
        commodity: baseData.commodity,
        harvestDate: baseData.harvestDate,
        seedSourceNumber: `${baseData.seedSourceNumber}-${timestamp}-${iteration}`,
        origin: baseData.origin,
        iupbNumber: baseData.iupbNumber,
        seedClass: baseData.seedClass,
        declaredQuantity: baseData.declaredQuantity,
        qtyBaseUnit: 'GRAM' // Default unit
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
    const seedData = getSeedBatchData(iteration);

    const createUrl = `${API_BASE_URL}/api/seed-batches`;

    // Create multipart form data with all required fields
    const formData = new FormData();
    formData.append('varietyName', seedData.varietyName);
    formData.append('commodity', seedData.commodity);
    formData.append('harvestDate', seedData.harvestDate);
    formData.append('seedSourceNumber', seedData.seedSourceNumber);
    formData.append('origin', seedData.origin);
    formData.append('iupbNumber', seedData.iupbNumber);
    formData.append('seedClass', seedData.seedClass);
    formData.append('declaredQuantity', String(seedData.declaredQuantity));
    formData.append('qtyBaseUnit', seedData.qtyBaseUnit);
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
        // Log successful request every 5 iterations to reduce console overhead
        if (__ITER % 5 === 0) {
            console.log(`✓ Iteration ${__ITER}: Seed batch created successfully`);
        }
    }

    // Think time - simulate real user behavior and reduce memory pressure
    sleep(Math.random() * 5 + 5); // Random sleep between 5-10 seconds
}

/**
 * Setup function - runs once before test
 */
export function setup() {
    console.log('=== K6 Load Test Setup ===');
    console.log(`Target: Max 50 Virtual Users`);
    console.log(`Duration: ~6.5 minutes total`);
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
