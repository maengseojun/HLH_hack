'use client';

import { useState } from 'react';

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
    retryAfterSec?: number;
  };
}

export default function ApiTestPage() {
  const [results, setResults] = useState<Record<string, ApiResponse>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const makeRequest = async (testName: string, url: string, options?: RequestInit) => {
    setLoading(prev => ({ ...prev, [testName]: true }));

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setResults(prev => ({
          ...prev,
          [testName]: { success: true, data }
        }));
      } else {
        setResults(prev => ({
          ...prev,
          [testName]: { success: false, error: data.error || data }
        }));
      }
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [testName]: {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }));
    } finally {
      setLoading(prev => ({ ...prev, [testName]: false }));
    }
  };

  const tests = [
    {
      name: 'Health Check',
      description: 'Test /health endpoint',
      action: () => makeRequest('health', 'http://localhost:3001/health'),
    },
    {
      name: 'Assets List',
      description: 'Test GET /v1/assets',
      action: () => makeRequest('assets', 'http://localhost:3001/v1/assets'),
    },
    {
      name: 'Asset Detail',
      description: 'Test GET /v1/assets/BTC',
      action: () => makeRequest('asset-detail', 'http://localhost:3001/v1/assets/BTC'),
    },
    {
      name: 'Asset Candles',
      description: 'Test GET /v1/assets/BTC-PERP/candles?interval=1d',
      action: () => makeRequest('candles', 'http://localhost:3001/v1/assets/BTC-PERP/candles?interval=1d'),
    },
    {
      name: 'Valid Basket Calculation',
      description: 'Test POST /v1/baskets/calculate with valid data',
      action: () => makeRequest('basket-valid', 'http://localhost:3001/v1/baskets/calculate', {
        method: 'POST',
        body: JSON.stringify({
          interval: '7d',
          assets: [
            { symbol: 'BTC-PERP', weight: 0.6, position: 'long' },
            { symbol: 'ETH-PERP', weight: 0.4, position: 'short', leverage: 2 }
          ]
        }),
      }),
    },
    {
      name: 'Invalid Weight Sum',
      description: 'Test basket calculation with invalid weight sum',
      action: () => makeRequest('basket-invalid-weight', 'http://localhost:3001/v1/baskets/calculate', {
        method: 'POST',
        body: JSON.stringify({
          interval: '7d',
          assets: [
            { symbol: 'BTC-PERP', weight: 0.5, position: 'long' },
            { symbol: 'ETH-PERP', weight: 0.4, position: 'short' }
          ]
        }),
      }),
    },
    {
      name: 'Invalid Input Validation',
      description: 'Test basket calculation with invalid input',
      action: () => makeRequest('basket-invalid-input', 'http://localhost:3001/v1/baskets/calculate', {
        method: 'POST',
        body: JSON.stringify({
          interval: 'invalid',
          assets: []
        }),
      }),
    },
  ];

  const runAllTests = async () => {
    for (const test of tests) {
      await test.action();
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between tests
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">HyperIndex API v1 Testing</h1>
          <button
            onClick={runAllTests}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Run All Tests
          </button>
        </div>

        <div className="mb-8 p-4 bg-blue-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Migration Status</h2>
          <ul className="text-sm space-y-1">
            <li>✅ Backend v1 API endpoints implemented</li>
            <li>✅ Error schema standardized (code/message/details/retryAfterSec)</li>
            <li>✅ Input validation working</li>
            <li>✅ Retry and inflight deduplication logic implemented</li>
            <li>⚠️ Upstream services (testnet.hyperliquid.xyz) currently unavailable</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tests.map((test) => (
            <div key={test.name} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{test.name}</h3>
                  <p className="text-sm text-gray-600">{test.description}</p>
                </div>
                <button
                  onClick={test.action}
                  disabled={loading[test.name.toLowerCase().replace(/\s+/g, '-')]}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading[test.name.toLowerCase().replace(/\s+/g, '-')] ? 'Testing...' : 'Test'}
                </button>
              </div>

              {results[test.name.toLowerCase().replace(/\s+/g, '-')] && (
                <div className="mt-4">
                  <div className={`p-3 rounded text-sm ${
                    results[test.name.toLowerCase().replace(/\s+/g, '-')].success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}>
                    {results[test.name.toLowerCase().replace(/\s+/g, '-')].success ? (
                      <div>
                        <div className="font-semibold text-green-800 mb-2">✅ Success</div>
                        <pre className="text-xs overflow-x-auto bg-white p-2 rounded border">
                          {JSON.stringify(results[test.name.toLowerCase().replace(/\s+/g, '-')].data, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div>
                        <div className="font-semibold text-red-800 mb-2">❌ Error</div>
                        {results[test.name.toLowerCase().replace(/\s+/g, '-')].error && (
                          <div className="space-y-1">
                            <div><strong>Code:</strong> {results[test.name.toLowerCase().replace(/\s+/g, '-')].error.code}</div>
                            <div><strong>Message:</strong> {results[test.name.toLowerCase().replace(/\s+/g, '-')].error.message}</div>
                            {results[test.name.toLowerCase().replace(/\s+/g, '-')].error.retryAfterSec && (
                              <div><strong>Retry After:</strong> {results[test.name.toLowerCase().replace(/\s+/g, '-')].error.retryAfterSec}s</div>
                            )}
                            {results[test.name.toLowerCase().replace(/\s+/g, '-')].error.details && (
                              <details className="mt-2">
                                <summary className="cursor-pointer font-medium">Details</summary>
                                <pre className="text-xs mt-1 overflow-x-auto bg-white p-2 rounded border">
                                  {JSON.stringify(results[test.name.toLowerCase().replace(/\s+/g, '-')].error.details, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
          <h3 className="font-semibold mb-2">Testing Notes</h3>
          <ul className="text-sm space-y-1 text-gray-700">
            <li>• The backend is configured to connect to <code>api.testnet.hyperliquid.xyz</code></li>
            <li>• Network errors are expected if the testnet is unavailable</li>
            <li>• Error responses follow the new v1 schema with <code>code</code>, <code>message</code>, <code>details</code>, and <code>retryAfterSec</code></li>
            <li>• Input validation errors (invalid weight sum, bad intervals) should work regardless of network status</li>
            <li>• Successful responses will include the <code>meta</code> object with normalization info</li>
          </ul>
        </div>
      </div>
    </div>
  );
}