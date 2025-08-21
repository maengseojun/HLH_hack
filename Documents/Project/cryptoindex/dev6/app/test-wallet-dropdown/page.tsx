'use client';

import React from 'react';
import { WalletConnectButton } from '@/components/wallet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function TestWalletDropdownPage() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Wallet Dropdown Test</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Test the wallet dropdown functionality with different states and interactions
        </p>
      </div>

      <div className="grid gap-8">
        {/* Main Test Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Wallet Connection Test</span>
              <Badge variant="secondary">Live Test</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Connect your wallet and click the button to test the dropdown functionality:
            </div>
            
            <div className="flex justify-center p-8 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <WalletConnectButton />
            </div>
            
            <div className="space-y-2 text-sm">
              <h4 className="font-semibold">Expected Behavior:</h4>
              <ul className="list-disc pl-5 space-y-1 text-gray-600 dark:text-gray-400">
                <li>Click "Connect Wallet" to connect via Privy</li>
                <li>After connection, the button becomes a dropdown trigger</li>
                <li>Click the connected wallet button to toggle the dropdown</li>
                <li>Dropdown shows: wallet address, email (if available), current network</li>
                <li>Click copy buttons to copy address or email</li>
                <li>Use network selector to switch networks</li>
                <li>Click "Disconnect Wallet" to disconnect</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Feature Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Dropdown Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-green-600">✅ User Information</h4>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>• Wallet address display with copy button</li>
                  <li>• Email address display (if available)</li>
                  <li>• Formatted address truncation</li>
                  <li>• Toast notifications for copy actions</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-green-600">✅ Network Information</h4>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>• Current network display with icon</li>
                  <li>• Chain ID information</li>
                  <li>• Integrated network selector</li>
                  <li>• Real-time network switching</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-green-600">✅ Action Buttons</h4>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>• Disconnect wallet functionality</li>
                  <li>• Proper dropdown state management</li>
                  <li>• Responsive design</li>
                  <li>• Dark mode support</li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-blue-600">🎨 Design Features</h4>
                <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>• Clean card-based layout</li>
                  <li>• Proper spacing and typography</li>
                  <li>• Consistent with existing button styles</li>
                  <li>• Radix UI Popover for accessibility</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Testing Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Testing Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <h4 className="font-semibold mb-2">Step 1: Connect Wallet</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Click "Connect Wallet" and choose either email login or wallet connection through Privy.
                </p>
              </div>
              
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <h4 className="font-semibold mb-2">Step 2: Test Dropdown</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  After connection, click the wallet button to open the dropdown. Verify all information displays correctly.
                </p>
              </div>
              
              <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <h4 className="font-semibold mb-2">Step 3: Test Features</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Test copy functionality, network switching, and disconnection to ensure all features work properly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technical Details */}
        <Card>
          <CardHeader>
            <CardTitle>Technical Implementation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Components Used:</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">WalletDropdown</Badge>
                  <Badge variant="outline">WalletConnectButton</Badge>
                  <Badge variant="outline">NetworkDisplay</Badge>
                  <Badge variant="outline">Radix UI Popover</Badge>
                  <Badge variant="outline">shadcn/ui Card</Badge>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-semibold mb-2">Key Features:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>State Management:</strong> React hooks for dropdown state
                  </div>
                  <div>
                    <strong>Accessibility:</strong> Radix UI for keyboard navigation
                  </div>
                  <div>
                    <strong>Copy Functionality:</strong> Clipboard API with toast feedback
                  </div>
                  <div>
                    <strong>Network Integration:</strong> Seamless network switching
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}