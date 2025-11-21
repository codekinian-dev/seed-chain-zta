import http from 'k6/http';
import { check, sleep } from 'k6';

// Smoke test - minimal load to verify API functionality
export const options = {
    vus: 1,
    duration: '30s',
    thresholds: {
        'http_req_duration': ['p(95)<1000'], // More relaxed for smoke test
        'http_req_failed': ['rate<0.05'],     // 5% error rate acceptable for smoke test
    },
};

const KEYCLOAK_URL = 'http://localhost:8080';
const KEYCLOAK_REALM = 'SeedCertificationRealm';
const KEYCLOAK_CLIENT_ID = 'seed-cert-frontend'; // Public client - no secret required
const API_BASE_URL = 'http://localhost:3000';
const USERNAME = 'producer_test';
const PASSWORD = 'Test123!';

function getAccessToken() {
    const tokenUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;

    const payload = {
        grant_type: 'password',
        client_id: KEYCLOAK_CLIENT_ID,
        username: USERNAME,
        password: PASSWORD,
    };

    const params = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    };

    const response = http.post(tokenUrl, payload, params);

    check(response, {
        'Login successful': (r) => r.status === 200,
    });

    return response.json('access_token');
}

export default function () {
    const token = getAccessToken();

    if (!token) {
        console.error('Failed to get access token');
        return;
    }

    // Test 1: Query all seed batches
    const listResponse = http.get(`${API_BASE_URL}/api/seed-batches`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    check(listResponse, {
        'List batches - status 200': (r) => r.status === 200,
        'List batches - response time < 1000ms': (r) => r.timings.duration < 1000,
    });

    console.log(`✓ Smoke test iteration ${__ITER}: API responding correctly`);

    sleep(2);
}

export function setup() {
    console.log('=== Smoke Test Setup ===');
    console.log('Testing basic API functionality with minimal load');
    console.log('1 VU for 30 seconds');
    console.log('========================');
}

export function teardown() {
    console.log('=== Smoke Test Completed ===');
    console.log('If all checks passed, API is ready for load testing');
}
