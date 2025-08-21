'use client';

import React, { useState } from 'react';
import { useWallets, usePrivy } from '@privy-io/react-auth';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { AlertTriangle, CheckCircle, XCircle, Network, Globe, ChevronDown, Check, Loader2, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SUPPORTED_CHAINS, DEFAULT_CHAIN_ID, ERROR_MESSAGES, THEME_COLORS } from './constants';
import { NetworkStatus, SupportedChain } from './types';
import { useNetworkSwitch } from './hooks/useNetworkSwitch';

interface NetworkDisplayProps {
  className?: string;
  showStatusIndicator?: boolean;
  size?: 'sm' | 'default' | 'lg';
  disabled?: boolean;
  onNetworkChange?: (chain: SupportedChain) => void;
}

export function NetworkDisplay({ 
  className, 
  showStatusIndicator = true, 
  size = 'default',
  disabled = false,
  onNetworkChange
}: NetworkDisplayProps) {
  const { wallets } = useWallets();
  const { ready, authenticated, login } = usePrivy();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { switchNetwork, isLoading: isSwitchingNetwork, error: switchError } = useNetworkSwitch();

  // Get current chain ID from the first connected wallet
  const getCurrentChainId = (): number => {
    if (wallets.length > 0 && wallets[0].chainId) {
      return parseInt(wallets[0].chainId.split(':')[1] || wallets[0].chainId);
    }
    return DEFAULT_CHAIN_ID;
  };

  const currentChainId = getCurrentChainId();
  const currentChain = SUPPORTED_CHAINS[currentChainId];

  // Determine network status
  const getNetworkStatus = (): NetworkStatus => {
    if (!currentChain) {
      return NetworkStatus.UNSUPPORTED;
    }
    
    if (wallets.length === 0) {
      return NetworkStatus.DISCONNECTED;
    }

    return NetworkStatus.CONNECTED;
  };

  const networkStatus = getNetworkStatus();

  // Get status indicator properties
  const getStatusIndicator = () => {
    switch (networkStatus) {
      case NetworkStatus.CONNECTED:
        return {
          icon: CheckCircle,
          color: 'text-green-400',
          bgColor: 'bg-green-400/10',
          borderColor: 'border-green-400/20',
          pulse: 'animate-pulse'
        };
      case NetworkStatus.UNSUPPORTED:
        return {
          icon: XCircle,
          color: 'text-red-400',
          bgColor: 'bg-red-400/10',
          borderColor: 'border-red-400/20',
          pulse: ''
        };
      case NetworkStatus.DISCONNECTED:
      default:
        return {
          icon: AlertTriangle,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-400/10',
          borderColor: 'border-yellow-400/20',
          pulse: ''
        };
    }
  };

  const statusIndicator = getStatusIndicator();
  const StatusIcon = statusIndicator.icon;

  // Get display name and fallback for unsupported chains
  const getDisplayName = () => {
    if (currentChain) {
      return currentChain.name;
    }
    return `Unknown Chain (${currentChainId})`;
  };

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'h-8 px-3 text-xs',
          icon: 'w-3 h-3',
          chainIcon: 'w-4 h-4',
          spacing: 'gap-1.5'
        };
      case 'lg':
        return {
          container: 'h-12 px-4 text-sm',
          icon: 'w-5 h-5',
          chainIcon: 'w-6 h-6',
          spacing: 'gap-3'
        };
      case 'default':
      default:
        return {
          container: 'h-10 px-3 text-sm',
          icon: 'w-4 h-4',
          chainIcon: 'w-5 h-5',
          spacing: 'gap-2'
        };
    }
  };

  const sizeClasses = getSizeClasses();

  // Handle network selection
  const handleNetworkSelect = async (chain: SupportedChain) => {
    if (disabled || isSwitchingNetwork) return;
    
    // Check if wallet is connected
    if (!ready || !authenticated || !wallets || wallets.length === 0) {
      // Close dropdown first
      setIsDropdownOpen(false);
      
      // Prompt user to connect wallet
      try {
        await login();
        // After successful login, try to switch network
        // Note: This will be handled by the wallet connection flow
      } catch (error) {
        console.error('Failed to connect wallet:', error);
      }
      return;
    }
    
    // Call the onNetworkChange callback if provided
    if (onNetworkChange) {
      onNetworkChange(chain);
    }
    
    // Attempt to switch network
    try {
      await switchNetwork(chain);
      setIsDropdownOpen(false);
    } catch (error) {
      // Error is already handled in the hook with toast
      console.error('Network switch failed:', error);
    }
  };

  // Get all supported chains as array
  const supportedChainsList = Object.values(SUPPORTED_CHAINS);

  // Check if wallet is connected
  const isWalletConnected = ready && authenticated && wallets && wallets.length > 0;

  return (
    <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild disabled={disabled || isSwitchingNetwork}>
        <div
          className={cn(
            'relative flex items-center justify-between rounded-lg transition-all duration-200 ease-out',
            'border backdrop-blur-sm cursor-pointer',
            sizeClasses.container,
            
            // Background and border colors based on status
            networkStatus === NetworkStatus.CONNECTED && [
              'bg-green-400/5 border-green-400/20',
              'hover:bg-green-400/10 hover:border-green-400/30'
            ],
            networkStatus === NetworkStatus.UNSUPPORTED && [
              'bg-red-400/5 border-red-400/20',
              'hover:bg-red-400/10 hover:border-red-400/30'
            ],
            networkStatus === NetworkStatus.DISCONNECTED && [
              'bg-yellow-400/5 border-yellow-400/20',
              'hover:bg-yellow-400/10 hover:border-yellow-400/30'
            ],
            
            // Disabled state
            (disabled || isSwitchingNetwork) && 'opacity-50 cursor-not-allowed',
            
            className
          )}
        >
          {/* Chain Info */}
          <div className={cn('flex items-center', sizeClasses.spacing)}>
            {/* Chain Icon */}
            <div className={cn(
              'relative flex items-center justify-center rounded-full',
              'transition-all duration-200',
              currentChain ? 'bg-white/10' : 'bg-gray-600/20',
              size === 'sm' ? 'p-1' : size === 'lg' ? 'p-2' : 'p-1.5'
            )}>
              {currentChain ? (
                <div className={cn(
                  'rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center',
                  sizeClasses.chainIcon
                )}>
                  <Network className={cn('text-white', 
                    size === 'sm' ? 'w-2 h-2' : size === 'lg' ? 'w-3 h-3' : 'w-2.5 h-2.5'
                  )} />
                </div>
              ) : (
                <Globe className={cn('text-gray-400', sizeClasses.chainIcon)} />
              )}
            </div>

            {/* Chain Name */}
            <div className="flex flex-col">
              <span className={cn(
                'font-medium transition-colors',
                currentChain ? 'text-white' : 'text-gray-400'
              )}>
                {getDisplayName()}
              </span>
              
              {/* Chain Symbol for supported chains */}
              {currentChain && (
                <span className={cn(
                  'text-xs text-gray-400',
                  size === 'sm' ? 'hidden' : 'block'
                )}>
                  {currentChain.shortName}
                </span>
              )}
            </div>
          </div>

          {/* Status Indicator & Dropdown Arrow */}
          <div className={cn('flex items-center', sizeClasses.spacing)}>
            {showStatusIndicator && (
              <>
                {/* Status Badge */}
                <Badge 
                  variant="outline" 
                  className={cn(
                    'border-0 text-xs font-medium',
                    statusIndicator.bgColor,
                    statusIndicator.color,
                    size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-0.5'
                  )}
                >
                  {networkStatus === NetworkStatus.CONNECTED && 'Connected'}
                  {networkStatus === NetworkStatus.UNSUPPORTED && 'Unsupported'}
                  {networkStatus === NetworkStatus.DISCONNECTED && 'Disconnected'}
                </Badge>

                {/* Status Icon */}
                <div className={cn(
                  'relative flex items-center justify-center',
                  statusIndicator.bgColor,
                  statusIndicator.borderColor,
                  'border rounded-full',
                  size === 'sm' ? 'p-1' : 'p-1.5'
                )}>
                  <StatusIcon className={cn(
                    statusIndicator.color,
                    sizeClasses.icon
                  )} />
                  
                  {/* Pulse effect for connected state */}
                  {networkStatus === NetworkStatus.CONNECTED && (
                    <div className={cn(
                      'absolute inset-0 rounded-full border-2 border-green-400/40',
                      'animate-ping'
                    )} />
                  )}
                </div>
              </>
            )}

            {/* Dropdown Arrow or Loading Indicator */}
            {!disabled && (
              <>
                {isSwitchingNetwork ? (
                  <Loader2 className={cn(
                    'text-blue-400 animate-spin',
                    sizeClasses.icon
                  )} />
                ) : (
                  <ChevronDown className={cn(
                    'text-gray-400 transition-transform duration-200',
                    sizeClasses.icon,
                    isDropdownOpen && 'rotate-180'
                  )} />
                )}
              </>
            )}
          </div>

          {/* Unsupported Chain Warning */}
          {networkStatus === NetworkStatus.UNSUPPORTED && (
            <div className="absolute -top-2 -right-2 z-10">
              <div className={cn(
                'flex items-center justify-center rounded-full',
                'bg-red-500 text-white border-2 border-red-400',
                'animate-pulse',
                size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
              )}>
                <AlertTriangle className={cn(
                  'text-white',
                  size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
                )} />
              </div>
            </div>
          )}

          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
        </div>
      </DropdownMenuTrigger>

      {/* Dropdown Content */}
      <DropdownMenuContent 
        className="w-64 bg-gray-800/95 backdrop-blur-sm border-gray-700 shadow-xl"
        align="end"
        sideOffset={8}
      >
        <DropdownMenuLabel className="text-gray-300 font-medium">
          Switch Network
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-700" />
        
        {isWalletConnected ? (
          supportedChainsList.map((chain) => {
            const isCurrentChain = chain.id === currentChainId;
            const isDisabled = isSwitchingNetwork || disabled;
            
            return (
              <DropdownMenuItem
                key={chain.id}
                onClick={() => !isDisabled && handleNetworkSelect(chain)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 transition-colors',
                  'hover:bg-gray-700/50 focus:bg-gray-700/50',
                  isCurrentChain && 'bg-blue-600/20 hover:bg-blue-600/30',
                  isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                )}
              >
                {/* Chain Icon */}
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/10">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <Network className="w-3 h-3 text-white" />
                  </div>
                </div>

                {/* Chain Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{chain.name}</span>
                    {isCurrentChain && (
                      <Check className="w-4 h-4 text-green-400" />
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{chain.shortName}</span>
                </div>

                {/* Status Badge */}
                {isCurrentChain && (
                  <Badge 
                    variant="outline" 
                    className="bg-green-500/10 text-green-400 border-green-500/30 text-xs"
                  >
                    Current
                  </Badge>
                )}
              </DropdownMenuItem>
            );
          })
        ) : (
          <DropdownMenuItem
            onClick={() => handleNetworkSelect(supportedChainsList[0])}
            className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-gray-700/50 focus:bg-gray-700/50"
          >
            {/* Wallet Icon */}
            <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10">
              <Wallet className="w-4 h-4 text-blue-400" />
            </div>

            {/* Connect Wallet Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">Connect Wallet</span>
              </div>
              <span className="text-xs text-gray-400">Required for network switching</span>
            </div>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="bg-gray-700" />
        
        {/* Footer Info */}
        <div className="px-3 py-2 text-xs text-gray-400">
          {isSwitchingNetwork ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Switching network...
            </div>
          ) : !isWalletConnected ? (
            'Connect wallet to switch networks'
          ) : (
            'Click to switch networks'
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}