// Global test setup
process.env.NODE_ENV = 'test';

// Mock external dependencies for testing
jest.mock('./services/hyperliquid.js', () => ({
  // Mock implementations will be added as needed
}));

jest.mock('./services/onchain.js', () => ({
  provider: {
    call: jest.fn(),
  },
}));