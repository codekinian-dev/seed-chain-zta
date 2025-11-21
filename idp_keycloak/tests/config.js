module.exports = {
  keycloakUrl: 'http://localhost:8041',
  realm: 'SeedCertificationRealm',
  clientId: 'seed-cert-frontend',

  // Test users (must be created in Keycloak)
  testUsers: {
    producer: {
      username: 'producer_test',
      password: 'Test123!',
      expectedRole: 'role_producer',
      expectedAttributes: {
        iup_number: 'IUP-2024-TEST-001',
        company_name: 'PT Benih Test Sejahtera'
      }
    },
    pbtField: {
      username: 'pbt_field_test',
      password: 'Test123!',
      expectedRole: 'role_pbt_field',
      expectedAttributes: {
        nip: '198501012010011001',
        institution_id: 'BPSBP-JABAR'
      }
    },
    lsmHead: {
      username: 'lsm_head_test',
      password: 'Test123!',
      expectedRole: 'role_lsm_head',
      expectedAttributes: {
        nip: '198601012011011002',
        institution_id: 'BPSBP-JABAR'
      }
    },
    public: {
      username: 'public_test',
      password: 'Test123!',
      expectedRole: 'role_public'
    },
    invalid: {
      username: 'nonexistent_user',
      password: 'WrongPassword123!'
    }
  },

  // Token settings
  tokenLifespan: 900, // 15 minutes in seconds

  // Brute force settings
  bruteForce: {
    maxAttempts: 5,
    lockoutDuration: 900 // 15 minutes in seconds
  }
};
