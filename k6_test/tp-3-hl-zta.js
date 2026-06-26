/**
 * =============================================================================
 * THROUGHPUT CEILING TEST — SCENARIO 3: HYPERLEDGER + ZTA
 * =============================================================================
 *
 * Arsitektur: Keycloak Auth → ZTA Policy Engine → Hyperledger Fabric
 * Endpoint:   POST /api/seed-batches/load-test
 * Tanpa sleep. constant-arrival-rate untuk throughput ceiling.
 * =============================================================================
 */

import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate } from 'k6/metrics';
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

const errorRate = new Rate('errors');

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

const API_BASE_URL = __ENV.API_BASE_URL || 'https://gateway.jabarchain.me';

const seedBatchDataset = new SharedArray('seedBatchData', function () {
    return JSON.parse(open('./documents/seed-batch-dataset.json'));
});

// Producer users only — semua akan di-ALLOW oleh ZTA
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
];

const tokenCache = {};

function getAccessToken(userIndex) {
    if (tokenCache[userIndex]) return tokenCache[userIndex];

    const user = TEST_USERS[userIndex % TEST_USERS.length];
    const response = http.post(
        `${API_BASE_URL}/api/v1/identity/login`,
        JSON.stringify({ username: user.username, password: user.password }),
        { headers: { 'Content-Type': 'application/json' }, tags: { name: 'Auth' } }
    );

    if (response.status !== 200) { errorRate.add(1); return null; }

    const token = response.json('data').accessToken;
    tokenCache[userIndex] = token;
    return token;
}

function getSeedBatchData(iteration) {
    const ts = Date.now();
    const idx = iteration % seedBatchDataset.length;
    const d = seedBatchDataset[idx];
    return {
        varietyName: d.variety,
        commodity: d.commodity,
        harvestDate: d.harvestDate,
        seedSourceNumber: `${d.seedSourceNumber}-TP-${ts}-${iteration}`,
        origin: d.origin,
        iupbNumber: d.iupbNumber,
        seedClass: d.seedClass,
        declaredQuantity: d.declaredQuantity,
        qtyBaseUnit: 'GRAM',
        documentName: `tp_zta_${iteration}.pdf`
    };
}

export default function () {
    const token = getAccessToken(__VU);
    if (!token) { errorRate.add(1); return; }

    const seedData = getSeedBatchData(__ITER);

    const response = http.post(
        `${API_BASE_URL}/api/seed-batches/load-test`,
        JSON.stringify(seedData),
        {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            tags: { name: 'Throughput3_HL_ZTA' },
        }
    );

    if (response.status === 200 || response.status === 201) {
        errorRate.add(0);
    } else {
        errorRate.add(1);
        if (__ITER % 10 === 0) console.error(`[TP3] ✗ ${response.status}`);
    }
}

export function setup() {
    console.log(`=== TP-3 HL+ZTA | Rate=${TARGET_RATE} req/s | Duration=3m ===`);
}

export function handleSummary(data) {
    const now = new Date();
    const ts = now.toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..*/, '');
    const r = data.metrics.http_req_duration || {};
    const h = data.metrics.http_reqs || {};
    const d = (data.state?.testRunDurationMs || 180000) / 1000;
    const throughput = (h.values?.rate || 0);

    const csv = `Scenario,Target_Rate,Actual_RPS,Avg_Resp_Time_ms,P95_Resp_Time_ms,P99_Resp_Time_ms,Min_Resp_Time_ms,Max_Resp_Time_ms,Error_Rate,Total_Requests,Test_Duration_sec\nTP_HL_ZTA,${TARGET_RATE},${throughput.toFixed(4)},${(r.values?.avg||0).toFixed(2)},${(r.values?.['p(95)']||0).toFixed(2)},${(r.values?.['p(99)']||0).toFixed(2)},${(r.values?.min||0).toFixed(2)},${(r.values?.max||0).toFixed(2)},${(data.metrics.errors?.values?.rate||0).toFixed(4)},${h.values?.count||0},${d.toFixed(2)}`;

    return {
        [`reports/tp-3-hl-zta-rate-${TARGET_RATE}-${ts}.csv`]: csv,
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}
