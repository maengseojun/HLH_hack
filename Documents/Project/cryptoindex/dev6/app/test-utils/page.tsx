'use client';

import React, { useState } from 'react';
import { 
  formatAddress, 
  copyToClipboard, 
  validateAddress, 
  isChecksumAddress,
  shortenHash,
  formatBalance,
  TEST_CASES 
} from '@/components/wallet/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Copy, Check, Wallet, Hash, DollarSign, Shield } from 'lucide-react';

export default function TestUtilsPage() {
  const [testAddress, setTestAddress] = useState('0x1234567890abcdef1234567890abcdef12345678');
  const [testHash, setTestHash] = useState('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
  const [testBalance, setTestBalance] = useState('123.456789');
  const [copyStatus, setCopyStatus] = useState<string>('');

  const handleCopy = async (text: string) => {
    const success = await copyToClipboard(text);
    setCopyStatus(success ? 'Copied!' : 'Failed to copy');
    setTimeout(() => setCopyStatus(''), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full">
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">
              Wallet Utility Functions Test
            </h1>
          </div>
          <p className="text-gray-300">
            Testing address formatting, validation, and clipboard functions
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Format Address Testing */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-blue-400" />
                Address Formatting
              </CardTitle>
              <CardDescription className="text-gray-300">
                Test formatAddress() function with different lengths
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-300 mb-2 block">Test Address:</label>
                <Input
                  value={testAddress}
                  onChange={(e) => setTestAddress(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white"
                  placeholder="Enter wallet address..."
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg border border-gray-600">
                  <span className="text-gray-300 font-medium">Default (4 chars):</span>
                  <code className="text-green-400 bg-gray-900 px-2 py-1 rounded">{formatAddress(testAddress)}</code>
                </div>
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg border border-gray-600">
                  <span className="text-gray-300 font-medium">Long (6 chars):</span>
                  <code className="text-blue-400 bg-gray-900 px-2 py-1 rounded">{formatAddress(testAddress, 6)}</code>
                </div>
                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-800 to-gray-700 rounded-lg border border-gray-600">
                  <span className="text-gray-300 font-medium">Short (2 chars):</span>
                  <code className="text-purple-400 bg-gray-900 px-2 py-1 rounded">{formatAddress(testAddress, 2)}</code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address Validation */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-400" />
                Address Validation
              </CardTitle>
              <CardDescription className="text-gray-300">
                Test validateAddress() and isChecksumAddress() functions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                  <span className="text-gray-300">Valid Format:</span>
                  {validateAddress(testAddress) ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded-full text-xs">
                      <CheckCircle className="w-3 h-3" /> Valid
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded-full text-xs">
                      <XCircle className="w-3 h-3" /> Invalid
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-800 rounded">
                  <span className="text-gray-300">Checksum:</span>
                  {isChecksumAddress(testAddress) ? (
                    <div className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded-full text-xs">
                      <CheckCircle className="w-3 h-3" /> Checksum
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-2 py-1 bg-yellow-600 text-white rounded-full text-xs">
                      <XCircle className="w-3 h-3" /> No Checksum
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-white font-medium mb-2">Test Cases:</h4>
                <div className="space-y-1 text-xs">
                  {TEST_CASES.validateAddress.valid.map((addr, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-400" />
                      <code className="text-gray-400">{formatAddress(addr)}</code>
                    </div>
                  ))}
                  {TEST_CASES.validateAddress.invalid.slice(0, 2).map((addr, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <XCircle className="w-3 h-3 text-red-400" />
                      <code className="text-gray-400">{addr.length > 20 ? formatAddress(addr) : addr}</code>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Clipboard Testing */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Copy className="w-5 h-5 text-purple-400" />
                Clipboard Functions
              </CardTitle>
              <CardDescription className="text-gray-300">
                Test copyToClipboard() function
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Button
                  onClick={() => handleCopy(testAddress)}
                  className="w-full flex items-center gap-2 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white border-0"
                >
                  {copyStatus === 'Copied!' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  Copy Address
                </Button>
                
                <Button
                  onClick={() => handleCopy('Test message from wallet utils!')}
                  className="w-full flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-0"
                >
                  <Copy className="w-4 h-4" />
                  Copy Test Message
                </Button>
              </div>

              {copyStatus && (
                <div className={`p-2 rounded text-center text-sm ${
                  copyStatus === 'Copied!' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-red-600 text-white'
                }`}>
                  {copyStatus}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hash and Balance Formatting */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Hash className="w-5 h-5 text-yellow-400" />
                Additional Utilities
              </CardTitle>
              <CardDescription className="text-gray-300">
                Test shortenHash() and formatBalance() functions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-gray-300 mb-2 block">Transaction Hash:</label>
                <Input
                  value={testHash}
                  onChange={(e) => setTestHash(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white mb-2"
                  placeholder="Enter transaction hash..."
                />
                <div className="p-2 bg-gray-800 rounded">
                  <span className="text-gray-300">Shortened: </span>
                  <code className="text-blue-400">{shortenHash(testHash)}</code>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-300 mb-2 block">Balance Amount:</label>
                <Input
                  value={testBalance}
                  onChange={(e) => setTestBalance(e.target.value)}
                  className="bg-gray-800 border-gray-600 text-white mb-2"
                  placeholder="Enter balance amount..."
                />
                <div className="space-y-1">
                  <div className="p-2 bg-gray-800 rounded text-sm">
                    <span className="text-gray-300">Default: </span>
                    <code className="text-green-400">{formatBalance(testBalance)}</code>
                  </div>
                  <div className="p-2 bg-gray-800 rounded text-sm">
                    <span className="text-gray-300">With ETH: </span>
                    <code className="text-green-400">{formatBalance(testBalance, 4, 'ETH')}</code>
                  </div>
                  <div className="p-2 bg-gray-800 rounded text-sm">
                    <span className="text-gray-300">2 Decimals: </span>
                    <code className="text-green-400">{formatBalance(testBalance, 2, 'USDC')}</code>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Function Documentation */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Available Functions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="text-white font-medium mb-2">Core Functions:</h4>
                <ul className="space-y-1 text-gray-300">
                  <li><code className="text-blue-400">formatAddress(address, length?)</code> - Format wallet address</li>
                  <li><code className="text-blue-400">copyToClipboard(text)</code> - Copy text to clipboard</li>
                  <li><code className="text-blue-400">validateAddress(address)</code> - Validate Ethereum address</li>
                  <li><code className="text-blue-400">isChecksumAddress(address)</code> - Check EIP-55 checksum</li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-medium mb-2">Helper Functions:</h4>
                <ul className="space-y-1 text-gray-300">
                  <li><code className="text-blue-400">shortenHash(hash, length?)</code> - Shorten transaction hash</li>
                  <li><code className="text-blue-400">formatBalance(balance, decimals?, symbol?)</code> - Format balance</li>
                  <li><code className="text-blue-400">toChecksumAddress(address)</code> - Convert to checksum</li>
                  <li><code className="text-blue-400">TEST_CASES</code> - Test data for validation</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}