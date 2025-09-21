// Global test setup
process.env.NODE_ENV = 'test';

// Set up environment variables for tests
process.env.CHAIN_RPC_URL = 'http://localhost:8545';
process.env.CHAIN_ID = '421614';
process.env.DB_URL = 'postgresql://test:test@localhost:5432/hyperindex_test';
process.env.DEMO_TOKEN = 'test_token_for_e2e';