'use client';

import React from 'react';
import { WalletConnectButton } from '@/components/wallet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestWalletButtonPage() {
  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            Enhanced Wallet Connect Button
          </h1>
          <p className="text-gray-300">
            Testing the new WalletConnectButton with MagicUI effects
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Default Button */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Default Button</CardTitle>
              <CardDescription className="text-gray-300">
                Gradient background with ripple effect
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <WalletConnectButton />
            </CardContent>
          </Card>

          {/* Large Button */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Large Button</CardTitle>
              <CardDescription className="text-gray-300">
                Larger size with enhanced animations
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <WalletConnectButton size="lg" />
            </CardContent>
          </Card>

          {/* Small Size */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Small Button</CardTitle>
              <CardDescription className="text-gray-300">
                Compact size with shimmer effect
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <WalletConnectButton size="sm" />
            </CardContent>
          </Card>

          {/* Custom Styled */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white">Full Width</CardTitle>
              <CardDescription className="text-gray-300">
                Full width with all effects
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WalletConnectButton 
                className="w-full" 
                variant="default"
              />
            </CardContent>
          </Card>

          {/* Demo Card for Connected State */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20 md:col-span-2 lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-white">Interactive Demo</CardTitle>
              <CardDescription className="text-gray-300">
                Click the button below to see all state transitions
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <WalletConnectButton size="lg" className="px-8" />
            </CardContent>
          </Card>
        </div>

        {/* Usage Instructions */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Enhanced Features</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 text-white">Visual Enhancements:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
                <li><strong>Disconnected:</strong> Blue-purple gradient with ripple effect</li>
                <li><strong>Connecting:</strong> Animated shimmer effect with pulsing spinner</li>
                <li><strong>Connected:</strong> Subtle gray background with border beam animation</li>
                <li><strong>Hover Effects:</strong> Scale transformation and enhanced shadows</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2 text-white">MagicUI Integrations:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-300">
                <li>Ripple effect on disconnected state</li>
                <li>BorderBeam animation on connected state</li>
                <li>Custom shimmer animation for loading</li>
                <li>Smooth transitions between all states</li>
                <li>Enhanced icon animations with glow effects</li>
                <li>Responsive hover and focus states</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}