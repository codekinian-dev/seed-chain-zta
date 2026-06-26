/**
 * =============================================================================
 * K6 QUERY TEST — SCENARIO 2: END-TO-END (AUTH + ZTA + IPFS)
 * =============================================================================
 *
 * Arsitektur: Client → Keycloak Auth → ZTA Policy Engine → HL Fabric → IPFS
 *
 * Menguji query end-to-end dengan middleware lengkap:
 * 1. Login via Gateway API (dapat token JWT dari Keycloak)
 * 2. Query seed batch via GET /api/seed-batches/:id
 *    → protect()           (validasi token Keycloak)
 *    → enforcePolicy()     (ZTA policy evaluation — RBAC)
 *    → chaincode querySeedBatch
 * 3. Ambil dokumen dari IPFS via GET /api/v1/documents/:cid
 *    → IPFS cluster retrieval
 *
 * Komponen: Auth + ZTA Policy + Chaincode Query + IPFS Retrieval
 * =============================================================================
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Counter, Trend } from 'k6/metrics';
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

// =============================================================================
// CUSTOM METRICS
// =============================================================================
const errorRate = new Rate('errors');
const e2eStep1Auth = new Trend('e2e_auth_duration');
const e2eStep2Query = new Trend('e2e_query_duration');
const e2eStep3Ipfs = new Trend('e2e_ipfs_duration');
const e2eTotal = new Trend('e2e_total_duration');
const e2eSuccess = new Counter('e2e_success');
const e2eFailed = new Counter('e2e_failed');

// =============================================================================
// TEST CONFIGURATION — sama dengan semua skenario (5→10→15 VUs)
// =============================================================================
export const options = {
    stages: [
        { duration: '30s', target: 5 },
        { duration: '1m', target: 5 },
        { duration: '30s', target: 10 },
        { duration: '1m', target: 10 },
        { duration: '30s', target: 15 },
        { duration: '1m', target: 15 },
        { duration: '30s', target: 0 },
    ],
    thresholds: {
        'http_req_duration': ['p(95)<15000'],
        'e2e_total_duration': ['p(95)<15000'],
        'errors': ['rate<0.15'],
        'http_req_failed': ['rate<0.10'],
    },
};

// =============================================================================
// API CONFIGURATION
// =============================================================================
const API_BASE_URL = 'https://gateway.jabarchain.me';

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
];

// =============================================================================
// BATCH IDS + IPFS CID — dari CouchDB
// =============================================================================
const BATCH_RECORDS = [
    { batch: 'BATCH-20260625-F58F20E6', cid: null },
    { batch: 'BATCH-20260625-EA58B7D5', cid: null },
    { batch: 'BATCH-20260625-B0C7838E', cid: null },
    { batch: 'BATCH-20260625-C9FF46D7', cid: null },
    { batch: 'BATCH-20260625-38111C6F', cid: null },
    { batch: 'BATCH-20260625-0483485D', cid: null },
    { batch: 'BATCH-20260625-E5385FA6', cid: null },
    { batch: 'BATCH-20260625-86839FCF', cid: null },
    { batch: 'BATCH-20260625-6AB13F8B', cid: null },
    { batch: 'BATCH-20260625-3C1F7827', cid: null },
    { batch: 'BATCH-20260625-76EB4241', cid: null },
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

    const loginParams = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        tags: { name: 'E2E_Login' },
    };

    const response = http.post(loginUrl, payload, loginParams);
    e2eStep1Auth.add(response.timings.duration);

    const checkRes = check(response, {
        'E2E login successful': (r) => r.status === 200,
    });

    if (!checkRes) {
        console.error(`E2E login failed: ${response.status} - ${response.body}`);
        errorRate.add(1);
        return null;
    }

    const token = response.json('data').accessToken;
    tokenCache[userIndex] = token;
    return token;
}

function getBatchRecord(iteration) {
    const idx = iteration % BATCH_RECORDS.length;
    return BATCH_RECORDS[idx];
}

// =============================================================================
// MAIN TEST SCENARIO — E2E QUERY
// =============================================================================
export default function () {
    const totalStart = Date.now();

    // -------------------------------------------------------------------------
    // STEP 1: Login (Auth via Keycloak / Gateway API)
    // -------------------------------------------------------------------------
    const vuId = __VU;
    const token = getAccessToken(vuId);

    if (!token) {
        errorRate.add(1);
        sleep(1);
        return;
    }

    // -------------------------------------------------------------------------
    // STEP 2: Query seed batch by ID melalui API Gateway
    // Middleware:
    //   protect()           → validasi token Keycloak
    //   enforcePolicy()     → ZTA policy evaluation (RBAC role_producer)
    //   controller         → fabricService.queryAsUser → querySeedBatch
    // -------------------------------------------------------------------------
    const iteration = __ITER;
    const record = getBatchRecord(iteration);
    const queryUrl = `${API_BASE_URL}/api/seed-batches/${record.batch}`;

    const queryParams = {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
        tags: { name: 'E2E_QueryBatch' },
    };

    const queryResponse = http.get(queryUrl, queryParams);
    e2eStep2Query.add(queryResponse.timings.duration);

    // Jika gagal atau IPFS CID tidak ada, skip step 3
    let ipfsCid = null;
    if (queryResponse.status === 200) {
        try {
            const body = queryResponse.json();
            ipfsCid = body.data?.seedSourceDocIpfsCid ||
                      body.data?.documents?.[0]?.cid ||
                      body.data?.ipfsCid;
        } catch (e) {
            // ignore parse error
        }
    }

    // -------------------------------------------------------------------------
    // STEP 3: Ambil dokumen dari IPFS (jika ada CID)
    // Endpoint: GET /api/v1/documents/:cid
    // Public — IPFS retrieval via gateway
    // -------------------------------------------------------------------------
    if (ipfsCid) {
        const ipfsUrl = `${API_BASE_URL}/api/v1/documents/${ipfsCid}`;
        const ipfsResponse = http.get(ipfsUrl, {
            tags: { name: 'E2E_IPFS_Retrieve' },
        });
        e2eStep3Ipfs.add(ipfsResponse.timings.duration);
    }

    const totalDuration = Date.now() - totalStart;
    e2eTotal.add(totalDuration);

    // -------------------------------------------------------------------------
    // Validate
    // -------------------------------------------------------------------------
    if (queryResponse.status === 200) {
        e2eSuccess.add(1);
        errorRate.add(0);

        if (__ITER % 5 === 0) {
            const ipfsInfo = ipfsCid ? ` | IPFS: ${String(ipfsCid).substring(0, 12)}...` : ' | (no CID)';
            console.log(`✓ Iter ${__ITER}: ${record.batch} | Total=${totalDuration}ms | Auth+Query=${queryResponse.timings.duration}ms${ipfsInfo}`);
        }
    } else if (queryResponse.status === 403) {
        console.error(`✗ Iter ${__ITER}: ZTA DENY ${record.batch}`);
        e2eFailed.add(1);
        errorRate.add(1);
    } else {
        console.error(`✗ Iter ${__ITER}: ${record.batch} status=${queryResponse.status}`);
        e2eFailed.add(1);
        errorRate.add(1);
    }

    sleep(Math.random() * 2 + 1); // 1-3 detik
}

// =============================================================================
// SETUP
// =============================================================================
export function setup() {
    console.log('=============================================');
    console.log('QUERY SCENARIO 2: END-TO-END (AUTH+ZTA+IPFS)');
    console.log('=============================================');
    console.log('Arsitektur: Keycloak → ZTA Policy → HL Query → IPFS');
    console.log('Step 1:     POST /api/v1/identity/login');
    console.log('Step 2:     GET  /api/seed-batches/:id (auth+policy)');
    console.log('Step 3:     GET  /api/v1/documents/:cid  (IPFS)');
    console.log('Komponen:   Auth + ZTA Policy + Chaincode + IPFS');
    console.log('Target:     Max 15 VUs, ~5 menit');
    console.log(`Batch:      ${BATCH_RECORDS.length} ID dari CouchDB`);
    console.log('=============================================');

    return { scenario: 'QUERY_E2E' };
}

// =============================================================================
// TEARDOWN
// =============================================================================
export function teardown(data) {
    console.log('=============================================');
    console.log('QUERY SCENARIO 2: E2E - SELESAI');
    console.log('=============================================');
}

// =============================================================================
// HANDLE SUMMARY
// =============================================================================
export function handleSummary(data) {
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/T/, '_')
        .replace(/:/g, '-')
        .replace(/\..*/, '');

    const httpReqDuration = data.metrics.http_req_duration || {};
    const e2eAuthMetric = data.metrics.e2e_auth_duration || {};
    const e2eQueryMetric = data.metrics.e2e_query_duration || {};
    const e2eIpfsMetric = data.metrics.e2e_ipfs_duration || {};
    const e2eTotalMetric = data.metrics.e2e_total_duration || {};
    const httpReqs = data.metrics.http_reqs || {};

    const avg = httpReqDuration.values?.avg || 0;
    const p95 = httpReqDuration.values?.['p(95)'] || 0;
    const p99 = httpReqDuration.values?.['p(99)'] || 0;
    const med = httpReqDuration.values?.med || 0;

    const e2eAvg = e2eTotalMetric.values?.avg || 0;
    const e2eP95 = e2eTotalMetric.values?.['p(95)'] || 0;

    const authAvg = e2eAuthMetric.values?.avg || 0;
    const queryAvg = e2eQueryMetric.values?.avg || 0;
    const ipfsAvg = e2eIpfsMetric.values?.avg || 0;

    const totalRequests = httpReqs.values?.count || 0;
    const testDuration = (data.state?.testRunDurationMs || 300000) / 1000;
    const throughputRPS = totalRequests / Math.max(testDuration, 1);

    const successCount = data.metrics.e2e_success?.values?.count || 0;
    const failCount = data.metrics.e2e_failed?.values?.count || 0;
    const errorRateValue = data.metrics.errors?.values?.rate || 0;

    const csvHeader = 'Scenario,Timestamp,Total_Requests,Success,Failed,Error_Rate_Pct,Avg_Resp_Time_ms,Med_Resp_Time_ms,P95_Resp_Time_ms,P99_Resp_Time_ms,E2E_Total_Avg_ms,E2E_Total_P95_ms,Auth_Avg_ms,Query_Avg_ms,IPFS_Avg_ms,Throughput_RPS,Test_Duration_sec';
    const csvData = `QUERY_E2E,${now.toISOString()},${totalRequests},${successCount},${failCount},${(errorRateValue * 100).toFixed(2)},${avg.toFixed(2)},${med.toFixed(2)},${p95.toFixed(2)},${p99.toFixed(2)},${e2eAvg.toFixed(2)},${e2eP95.toFixed(2)},${authAvg.toFixed(2)},${queryAvg.toFixed(2)},${ipfsAvg.toFixed(2)},${throughputRPS.toFixed(4)},${testDuration.toFixed(2)}`;
    const csvContent = `${csvHeader}\n${csvData}`;

    return {
        [`reports/query-q2-e2e-${timestamp}.csv`]: csvContent,
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}
