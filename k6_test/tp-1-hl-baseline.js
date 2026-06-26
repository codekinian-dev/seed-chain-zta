/**
 * =============================================================================
 * THROUGHPUT CEILING TEST — SCENARIO 1: HYPERLEDGER ONLY (BASELINE)
 * =============================================================================
 *
 * Menggunakan executor constant-arrival-rate untuk memaksa arrival rate konstan.
 * Tidak ada think time — throughput diukur dari sisi sistem, bukan dari iterasi.
 *
 * Arsitektur: Keycloak Auth → Hyperledger Fabric Chaincode
 * Endpoint:   POST /api/seed-batches/load-test
 *
 * Jalankan dengan rate bertahap: 2, 5, 10, 20, 30 req/s
 * Melalui:    ./run-throughput.sh
 *
 * Output metric utama:
 *   - http_reqs        = throughput aktual (req/s) — inilah throughput ceiling
 *   - http_req_duration = latency pada setiap arrival rate
 *   - http_req_failed   = indikasi saturasi
 * =============================================================================
 */

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate } from 'k6/metrics';
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// =============================================================================
// CUSTOM METRICS
// =============================================================================
const errorRate = new Rate('errors');

// =============================================================================
// TEST CONFIGURATION
// =============================================================================
// Rate parameter — di-override oleh runner script via --env RATE=...
const TARGET_RATE = __ENV.RATE ? parseInt(__ENV.RATE) : 2;

export const options = {
    scenarios: {
        throughput_test: {
            executor: 'constant-arrival-rate',
            rate: TARGET_RATE,
            timeUnit: '1s',
            duration: '3m',
            preAllocatedVUs: 20,
            maxVUs: 50,
        },
    },
    thresholds: {
        'http_req_duration': ['p(95)<15000'],
        'http_req_failed': ['rate<0.05'],
    },
};

// =============================================================================
// API CONFIGURATION
// =============================================================================
const API_BASE_URL = __ENV.API_BASE_URL || 'https://gateway.jabarchain.me';

// =============================================================================
// DATASET
// =============================================================================
const seedBatchDataset = new SharedArray('seedBatchData', function () {
    return JSON.parse(open('./documents/seed-batch-dataset.json'));
});

// =============================================================================
// TEST USERS
// =============================================================================
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

// =============================================================================
// TOKEN CACHE per VU
// =============================================================================
const tokenCache = {};

function getAccessToken(userIndex) {
    if (tokenCache[userIndex]) {
        return tokenCache[userIndex];
    }

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
        tags: { name: 'AuthLogin' },
    };

    const response = http.post(loginUrl, payload, params);

    const checkRes = check(response, {
        'login ok': (r) => r.status === 200,
    });

    if (!checkRes) {
        console.error(`Login failed ${user.username}: ${response.status}`);
        errorRate.add(1);
        return null;
    }

    const token = response.json('data').accessToken;
    tokenCache[userIndex] = token;
    return token;
}

function getSeedBatchData(iteration) {
    const timestamp = Date.now();
    const dataIndex = iteration % seedBatchDataset.length;
    const baseData = seedBatchDataset[dataIndex];

    return {
        varietyName: baseData.variety,
        commodity: baseData.commodity,
        harvestDate: baseData.harvestDate,
        seedSourceNumber: `${baseData.seedSourceNumber}-TPT-${timestamp}-${iteration}`,
        origin: baseData.origin,
        iupbNumber: baseData.iupbNumber,
        seedClass: baseData.seedClass,
        declaredQuantity: baseData.declaredQuantity,
        qtyBaseUnit: 'GRAM',
        documentName: `tp_test_doc_${iteration}.pdf`
    };
}

// =============================================================================
// MAIN — TANPA SLEEP
// =============================================================================
export default function () {
    const vuId = __VU;
    const token = getAccessToken(vuId);

    if (!token) {
        errorRate.add(1);
        return;
    }

    const iteration = __ITER;
    const seedData = getSeedBatchData(iteration);

    const createUrl = `${API_BASE_URL}/api/seed-batches/load-test`;

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        tags: { name: 'Throughput1_HL' },
    };

    const response = http.post(createUrl, JSON.stringify(seedData), params);

    if (response.status === 200 || response.status === 201) {
        errorRate.add(0);
    } else {
        errorRate.add(1);
        if (__ITER % 10 === 0) {
            console.error(`[TP1] ✗ ${response.status}`);
        }
    }
    // TANPA SLEEP — throughput murni
}

// =============================================================================
// SETUP
// =============================================================================
export function setup() {
    console.log(`=== TP-1 HL BASELINE | Rate=${TARGET_RATE} req/s | Duration=3m ===`);
    return { scenario: 'TP_HL', rate: TARGET_RATE };
}

// =============================================================================
// HANDLE SUMMARY
// =============================================================================
export function handleSummary(data) {
    const now = new Date();
    const ts = now.toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..*/, '');

    const reqDuration = data.metrics.http_req_duration || {};
    const httpReqs = data.metrics.http_reqs || {};
    const testDuration = (data.state?.testRunDurationMs || 180000) / 1000;

    // Throughput aktual (req/s)
    const throughput = (httpReqs.values?.rate || 0);

    const csvHeader = 'Scenario,Target_Rate,Actual_RPS,Avg_Resp_Time_ms,P95_Resp_Time_ms,P99_Resp_Time_ms,Min_Resp_Time_ms,Max_Resp_Time_ms,Error_Rate,Total_Requests,Test_Duration_sec';
    const csvData = `TP_HL,${TARGET_RATE},${throughput.toFixed(4)},${(reqDuration.values?.avg||0).toFixed(2)},${(reqDuration.values?.['p(95)']||0).toFixed(2)},${(reqDuration.values?.['p(99)']||0).toFixed(2)},${(reqDuration.values?.min||0).toFixed(2)},${(reqDuration.values?.max||0).toFixed(2)},${(data.metrics.errors?.values?.rate||0).toFixed(4)},${httpReqs.values?.count||0},${testDuration.toFixed(2)}`;

    return {
        [`reports/tp-1-hl-rate-${TARGET_RATE}-${ts}.csv`]: csvContent,
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}
