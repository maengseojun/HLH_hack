'use client';

import React, { useState } from 'react';
import { NetworkDisplay } from '@/components/wallet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Network, Eye, EyeOff, Zap, Settings, MousePointer, Ban, Repeat } from 'lucide-react';
import { SupportedChain } from '@/components/wallet/types';

export default function TestNetworkDisplayPage() {
  const [showStatusIndicator, setShowStatusIndicator] = useState(true);
  const [selectedSize, setSelectedSize] = useState<'sm' | 'default' | 'lg'>('default');
  const [disabled, setDisabled] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedChain | null>(null);

  const sizes = [
    { value: 'sm', label: 'Small', description: 'Compact display for tight spaces' },
    { value: 'default', label: 'Default', description: 'Standard size for most use cases' },
    { value: 'lg', label: 'Large', description: 'Prominent display for main navigation' }
  ] as const;

  const handleNetworkChange = (chain: SupportedChain) => {
    setSelectedNetwork(chain);
    console.log('Network selected:', chain);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-r from-green-500 to-blue-600 rounded-full">
              <Repeat className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">
              NetworkDisplay with Switching
            </h1>
          </div>
          <p className="text-gray-300">
            Testing network display component with live chain switching functionality
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Panel */}
          <Card className="lg:col-span-1 bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-400" />
                Configuration
              </CardTitle>
              <CardDescription className="text-gray-300">
                Adjust component props to test different states
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Status Indicator Toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="status-toggle" className="text-gray-300 flex items-center gap-2">
                  {showStatusIndicator ? (
                    <Eye className="w-4 h-4 text-green-400" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  )}
                  Status Indicator
                </Label>
                <Switch
                  id="status-toggle"
                  checked={showStatusIndicator}
                  onCheckedChange={setShowStatusIndicator}
                />
              </div>

              {/* Disabled Toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="disabled-toggle" className="text-gray-300 flex items-center gap-2">
                  {disabled ? (
                    <Ban className="w-4 h-4 text-red-400" />
                  ) : (
                    <MousePointer className="w-4 h-4 text-blue-400" />
                  )}
                  Disabled State
                </Label>
                <Switch
                  id="disabled-toggle"
                  checked={disabled}
                  onCheckedChange={setDisabled}
                />
              </div>

              {/* Size Selection */}
              <div className="space-y-2">
                <Label className="text-gray-300">Component Size</Label>
                <div className="grid grid-cols-1 gap-2">
                  {sizes.map((size) => (
                    <Button
                      key={size.value}
                      variant={selectedSize === size.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedSize(size.value)}
                      className={`justify-start text-left py-3 h-auto ${
                        selectedSize === size.value
                          ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-medium">{size.label}</span>
                        <span className="text-xs opacity-70">{size.description}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Current Configuration */}
              <div className="pt-4 border-t border-white/10">
                <h4 className="text-white font-medium mb-2">Current Config:</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                      Size: {selectedSize}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`${
                        showStatusIndicator 
                          ? 'bg-green-500/10 text-green-400 border-green-500/30' 
                          : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                      }`}
                    >
                      Status: {showStatusIndicator ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`${
                        disabled 
                          ? 'bg-red-500/10 text-red-400 border-red-500/30' 
                          : 'bg-green-500/10 text-green-400 border-green-500/30'
                      }`}
                    >
                      Interaction: {disabled ? 'Disabled' : 'Enabled'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Selected Network Display */}
              {selectedNetwork && (
                <div className="pt-4 border-t border-white/10">
                  <h4 className="text-white font-medium mb-2">Last Selected Network:</h4>
                  <div className="p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                        <Network className="w-3 h-3 text-white" />
                      </div>
                      <div>
                        <span className="text-white font-medium">{selectedNetwork.name}</span>
                        <span className="text-gray-400 text-sm ml-2">({selectedNetwork.shortName})</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Live Preview */}
          <Card className="lg:col-span-2 bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-400" />
                Live Preview
              </CardTitle>
              <CardDescription className="text-gray-300">
                Real-time component rendering with current configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Current Network Display */}
              <div className="space-y-2">
                <Label className="text-gray-300">Network Display with Dropdown</Label>
                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                  <NetworkDisplay
                    showStatusIndicator={showStatusIndicator}
                    size={selectedSize}
                    disabled={disabled}
                    onNetworkChange={handleNetworkChange}
                    className="w-full"
                  />
                </div>
                <div className="text-xs text-gray-400 mt-2 space-y-1">
                  <div>• Click the component to open the network selection dropdown</div>
                  <div>• Select a network to trigger actual chain switching</div>
                  <div>• Toast notifications will show switch progress and results</div>
                </div>
              </div>

              {/* Different States Demo */}
              <div className="space-y-4">
                <Label className="text-gray-300">All Size Variants</Label>
                <div className="grid grid-cols-1 gap-4">
                  {sizes.map((size) => (
                    <div key={size.value} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">{size.label} ({size.value})</span>
                        <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/30 text-xs">
                          {size.description}
                        </Badge>
                      </div>
                      <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700">
                        <NetworkDisplay
                          showStatusIndicator={showStatusIndicator}
                          size={size.value}
                          disabled={disabled}
                          onNetworkChange={handleNetworkChange}
                          className="w-full max-w-md"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Component Information */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Network className="w-5 h-5 text-emerald-400" />
              Component Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="text-white font-medium mb-3">Core Features:</h4>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    Current network detection via Privy useWallets
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-400 rounded-full" />
                    Support for Ethereum, Arbitrum, Polygon, Base, Optimism
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-400 rounded-full" />
                    Live network switching with wallet integration
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                    Loading states and error handling
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-400 rounded-full" />
                    Toast notifications for user feedback
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-400 rounded-full" />
                    Automatic chain addition for unsupported networks
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-medium mb-3">Available Props:</h4>
                <ul className="space-y-2 text-gray-300">
                  <li><code className="text-blue-400">className?</code> - Custom styling</li>
                  <li><code className="text-blue-400">showStatusIndicator?</code> - Toggle status display</li>
                  <li><code className="text-blue-400">size?</code> - Component size (sm, default, lg)</li>
                  <li><code className="text-blue-400">disabled?</code> - Disable dropdown interaction</li>
                  <li><code className="text-blue-400">onNetworkChange?</code> - Network selection callback</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Examples */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Usage Examples</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="text-white font-medium mb-2">Basic Usage:</h4>
                <code className="text-green-400 text-sm">
                  {'<NetworkDisplay />'}
                </code>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="text-white font-medium mb-2">With Network Switching:</h4>
                <code className="text-green-400 text-sm">
                  {'<NetworkDisplay size="lg" onNetworkChange={handleNetworkChange} />'}
                </code>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="text-white font-medium mb-2">Using Network Switch Hook:</h4>
                <code className="text-green-400 text-sm">
                  {'const { switchNetwork, isLoading, error } = useNetworkSwitch();'}
                </code>
              </div>
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="text-white font-medium mb-2">Import Statements:</h4>
                <code className="text-green-400 text-sm">
                  {"import { NetworkDisplay, useNetworkSwitch } from '@/components/wallet';"}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}