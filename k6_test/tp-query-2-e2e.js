/**
 * =============================================================================
 * THROUGHPUT CEILING — QUERY 2: END-TO-END (AUTH + ZTA + IPFS)
 * =============================================================================
 *
 * Step 1: POST /api/v1/identity/login        (Auth via Gateway)
 * Step 2: GET  /api/seed-batches/:id          (Auth + ZTA policy + HL query)
 * Step 3: GET  /api/v1/documents/:cid         (IPFS retrieval)
 *
 * Tanpa sleep. constant-arrival-rate.
 * =============================================================================
 */

import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.1/index.js";

const errorRate = new Rate('errors');
const step2Query = new Trend('q2_query_duration');
const step3Ipfs = new Trend('q2_ipfs_duration');

const TARGET_RATE = __ENV.RATE ? parseInt(__ENV.RATE) : 5;

export const options = {
    scenarios: {
        throughput_test: {
            executor: 'constant-arrival-rate',
            rate: TARGET_RATE,
            timeUnit: '1s',
            duration: '2m',
            preAllocatedVUs: 20,
            maxVUs: 100,
        },
    },
    thresholds: {
        'http_req_duration': ['p(95)<5000'],
        'http_req_failed': ['rate<0.10'],
    },
};

const API_BASE_URL = __ENV.API_BASE_URL || 'https://gateway.jabarchain.me';

const TEST_USERS = [
    { username: '1E1DFC06', password: 'Test123!' },
    { username: '46FC9A16', password: 'Test123!' },
    { username: 'B59D7AAB', password: 'Test123!' },
    { username: 'C258D1E8', password: 'Test123!' },
    { username: 'E9C38C5C', password: 'Test123!' },
    { username: '812E38B8', password: 'Test123!' },
];

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

const tokenCache = {};

function getRecord(iter) {
    return BATCH_RECORDS[iter % BATCH_RECORDS.length];
}

export default function () {
    // Step 1: Login — ambil token
    const user = TEST_USERS[__VU % TEST_USERS.length];
    let token = tokenCache[__VU];

    if (!token) {
        const loginRes = http.post(
            `${API_BASE_URL}/api/v1/identity/login`,
            JSON.stringify({ username: user.username, password: user.password }),
            { headers: { 'Content-Type': 'application/json' }, tags: { name: 'TP_Q2_Login' } }
        );
        if (loginRes.status !== 200) { errorRate.add(1); return; }
        token = loginRes.json('data').accessToken;
        tokenCache[__VU] = token;
    }

    // Step 2: Query batch
    const record = getRecord(__ITER);
    const queryRes = http.get(
        `${API_BASE_URL}/api/seed-batches/${record.batch}`,
        { headers: { 'Authorization': `Bearer ${token}` }, tags: { name: 'TP_Q2_Query' } }
    );
    step2Query.add(queryRes.timings.duration);

    let ipfsCid = null;
    if (queryRes.status === 200) {
        try {
            const body = queryRes.json();
            ipfsCid = body.data?.seedSourceDocIpfsCid ||
                      body.data?.documents?.[0]?.cid;
        } catch (e) { /* ignore */ }
    }

    // Step 3: IPFS retrieval (jika ada CID)
    if (ipfsCid) {
        const ipfsRes = http.get(
            `${API_BASE_URL}/api/v1/documents/${ipfsCid}`,
            { tags: { name: 'TP_Q2_IPFS' } }
        );
        step3Ipfs.add(ipfsRes.timings.duration);
    }

    const isOk = queryRes.status === 200;
    errorRate.add(isOk ? 0 : 1);
    // TANPA SLEEP
}

export function setup() {
    console.log(`=== TP-QUERY-2 E2E | Rate=${TARGET_RATE} req/s | Duration=2m ===`);
}

export function handleSummary(data) {
    const now = new Date();
    const ts = now.toISOString().replace(/T/, '_').replace(/:/g, '-').replace(/\..*/, '');
    const r = data.metrics.http_req_duration || {};
    const h = data.metrics.http_reqs || {};
    const d = (data.state?.testRunDurationMs || 120000) / 1000;
    const throughput = (h.values?.rate || 0);
    const q2 = data.metrics.q2_query_duration || {};
    const i2 = data.metrics.q2_ipfs_duration || {};

    const csv = `Scenario,Target_Rate,Actual_RPS,Avg_Resp_Time_ms,P95_Resp_Time_ms,P99_Resp_Time_ms,Min_Resp_Time_ms,Max_Resp_Time_ms,Error_Rate,Query_Avg_ms,IPFS_Avg_ms,Total_Requests,Test_Duration_sec\nTP_QUERY2_E2E,${TARGET_RATE},${throughput.toFixed(4)},${(r.values?.avg||0).toFixed(2)},${(r.values?.['p(95)']||0).toFixed(2)},${(r.values?.['p(99)']||0).toFixed(2)},${(r.values?.min||0).toFixed(2)},${(r.values?.max||0).toFixed(2)},${(data.metrics.errors?.values?.rate||0).toFixed(4)},${(q2.values?.avg||0).toFixed(2)},${(i2.values?.avg||0).toFixed(2)},${h.values?.count||0},${d.toFixed(2)}`;

    return {
        [`reports/tp-query-2-e2e-rate-${TARGET_RATE}-${ts}.csv`]: csv,
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    };
}
