'use client';

import React, { useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { Copy, LogOut, ChevronDown, CheckCircle, Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatAddress, copyToClipboard } from './utils';
import { SUPPORTED_CHAINS } from './constants';
import { NetworkDisplay } from './NetworkDisplay';
import { toast } from 'react-hot-toast';
import Ripple from '@/components/magicui/ripple';

interface WalletDropdownProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onDisconnect: () => void;
  className?: string;
}

export function WalletDropdown({ 
  isOpen, 
  onOpenChange, 
  onDisconnect, 
  className 
}: WalletDropdownProps) {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  
  // State for copy feedback
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());

  // Get wallet address
  const getWalletAddress = (): string | null => {
    if (user?.wallet?.address) {
      return user.wallet.address;
    }
    
    if (wallets.length > 0 && wallets[0].address) {
      return wallets[0].address;
    }
    
    if (user?.linkedAccounts) {
      const walletAccount = user.linkedAccounts.find(
        account => account.address && account.type === 'wallet'
      );
      if (walletAccount?.address) {
        return walletAccount.address;
      }
    }
    
    return null;
  };

  // Get user email
  const getUserEmail = (): string | null => {
    if (user?.email?.address) {
      return user.email.address;
    }
    
    if (user?.linkedAccounts) {
      const emailAccount = user.linkedAccounts.find(
        account => account.type === 'email'
      );
      if (emailAccount && 'address' in emailAccount) {
        return emailAccount.address as string;
      }
    }
    
    return null;
  };

  // Get current chain info
  const getCurrentChain = () => {
    if (wallets.length > 0) {
      const currentChainId = wallets[0].chainId;
      return SUPPORTED_CHAINS[parseInt(currentChainId)] || SUPPORTED_CHAINS[1]; // Default to Ethereum (chainId 1)
    }
    return SUPPORTED_CHAINS[1]; // Default to Ethereum (chainId 1)
  };

  // Enhanced address copy with visual feedback
  const handleCopyAddress = async (address: string, label: string = 'Address') => {
    const success = await copyToClipboard(address);
    if (success) {
      // Add to copied items for visual feedback
      setCopiedItems(prev => new Set(prev).add(address));
      
      // Show toast notification
      toast.success(`${label} copied to clipboard!`);
      
      // Remove from copied items after 2 seconds
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(address);
          return newSet;
        });
      }, 2000);
    } else {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };
  
  // Check if item was recently copied
  const isRecentlyCopied = (item: string) => copiedItems.has(item);

  // Handle disconnect
  const handleDisconnect = () => {
    onDisconnect();
    onOpenChange(false);
  };

  const walletAddress = getWalletAddress();
  const userEmail = getUserEmail();
  const currentChain = getCurrentChain();

  if (!walletAddress) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "relative overflow-hidden transition-all duration-300 ease-out",
              "border-0 font-medium backdrop-blur-sm",
              "hover:scale-105 active:scale-95",
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              "bg-gradient-to-r from-blue-500 to-purple-600 text-white",
              "hover:from-blue-600 hover:to-purple-700",
              "shadow-lg hover:shadow-xl",
              "focus:ring-blue-400",
              className
            )}
          >
            {/* Ripple effect for connected state */}
            <Ripple 
              mainCircleSize={80} 
              mainCircleOpacity={0.2} 
              numCircles={3}
              className="absolute inset-0" 
            />
            
            {/* Content */}
            <div className="relative z-10 flex items-center gap-2">
              <div className="relative">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <div className="absolute inset-0 rounded-full bg-green-400/20 animate-pulse" />
              </div>
              <span className="font-medium">Wallet Connected</span>
              <ChevronDown className="w-3 h-3 opacity-60 hover:opacity-100 transition-opacity" />
            </div>
          </Button>
        </div>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-80 p-0" 
        align="end"
        sideOffset={8}
      >
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Wallet Information
              </h3>
              <Badge variant="secondary" className="text-xs">
                Connected
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* User Info Section */}
            <div className="space-y-3">
              {/* Wallet Address */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Wallet Address
                </label>
                <div 
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => handleCopyAddress(walletAddress, 'Wallet address')}
                >
                  <span className="text-sm font-mono text-gray-900 dark:text-gray-100 flex-1 select-all">
                    {formatAddress(walletAddress, 8)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyAddress(walletAddress, 'Wallet address');
                    }}
                    className={cn(
                      "h-6 w-6 p-0 transition-all duration-200",
                      isRecentlyCopied(walletAddress) 
                        ? "bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800" 
                        : "hover:bg-gray-200 dark:hover:bg-gray-600"
                    )}
                  >
                    {isRecentlyCopied(walletAddress) ? (
                      <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Email Address (if available) */}
              {userEmail && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Email Address
                  </label>
                  <div 
                    className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => handleCopyAddress(userEmail, 'Email address')}
                  >
                    <span className="text-sm text-gray-900 dark:text-gray-100 flex-1 select-all">
                      {userEmail}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyAddress(userEmail, 'Email address');
                      }}
                      className={cn(
                        "h-6 w-6 p-0 transition-all duration-200",
                        isRecentlyCopied(userEmail) 
                          ? "bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800" 
                          : "hover:bg-gray-200 dark:hover:bg-gray-600"
                      )}
                    >
                      {isRecentlyCopied(userEmail) ? (
                        <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Network Info Section */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Current Network
              </label>
              <div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                <img 
                  src={currentChain.iconUrl} 
                  alt={currentChain.name}
                  className="w-6 h-6 rounded-full"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {currentChain.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Chain ID: {currentChain.id}
                  </div>
                </div>
                <Globe className="w-4 h-4 text-gray-400" />
              </div>
              
              {/* Network Selector */}
              <div className="pt-1">
                <NetworkDisplay 
                  size="sm" 
                  showStatusIndicator={false}
                  className="w-full"
                />
              </div>
            </div>

            <Separator />

            {/* Action Buttons Section */}
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
              >
                <LogOut className="w-4 h-4" />
                Disconnect Wallet
              </Button>
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}