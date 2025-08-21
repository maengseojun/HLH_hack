"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BlurIn, AnimatedGradientText, SlideIn, Ripple, NumberTicker } from "@/components/magicui";
import { CardSpotlight } from "@/components/ui/card-hover-effect";
import { motion } from 'framer-motion';
import { Wallet, Smartphone, Zap, CheckCircle, X } from "lucide-react";

interface WalletOption {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  badge?: string;
  isPopular?: boolean;
}

const walletOptions: WalletOption[] = [
  {
    id: "metamask",
    name: "MetaMask",
    icon: Wallet,
    description: "Most popular wallet",
    badge: "Popular",
    isPopular: true,
  },
  {
    id: "walletconnect",
    name: "WalletConnect",
    icon: Smartphone,
    description: "Mobile friendly",
    badge: "Mobile",
  },
  {
    id: "phantom",
    name: "Phantom",
    icon: Zap,
    description: "Solana native",
    badge: "Solana",
  },
];

interface WalletConnectionDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function WalletConnectionDialog({
  trigger,
  open,
  onOpenChange,
}: WalletConnectionDialogProps) {
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [connectionProgress, setConnectionProgress] = useState(0);

  const handleWalletSelect = async (walletId: string) => {
    setSelectedWallet(walletId);
    setConnectionStatus('connecting');
    setConnectionProgress(0);

    // Simulate connection process
    const interval = setInterval(() => {
      setConnectionProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setConnectionStatus('connected');
          return 100;
        }
        return prev + 10;
      });
    }, 200);

    // Simulate connection delay
    setTimeout(() => {
      clearInterval(interval);
      setConnectionStatus('connected');
      setConnectionProgress(100);
    }, 2000);
  };

  const handleClose = () => {
    setSelectedWallet(null);
    setConnectionStatus('idle');
    setConnectionProgress(0);
    onOpenChange?.(false);
  };

  const renderConnectionStatus = () => {
    switch (connectionStatus) {
      case 'connecting':
        return (
          <BlurIn duration={0.3}>
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-cryptoindex-accent/20 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-cryptoindex-accent border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="space-y-2">
                <AnimatedGradientText className="text-lg font-semibold">
                  Connecting wallet...
                </AnimatedGradientText>
                <p className="text-cryptoindex-warm text-sm">
                  {selectedWallet === 'metamask' && 'Check your MetaMask browser extension'}
                  {selectedWallet === 'walletconnect' && 'Scan the QR code with your wallet'}
                  {selectedWallet === 'phantom' && 'Open your Phantom wallet'}
                </p>
                <div className="flex items-center justify-center space-x-2">
                  <NumberTicker 
                    value={connectionProgress} 
                    suffix="%" 
                    className="text-cryptoindex-highlight font-mono"
                  />
                  <span className="text-cryptoindex-warm text-sm">complete</span>
                </div>
              </div>
            </div>
          </BlurIn>
        );
      case 'connected':
        return (
          <BlurIn duration={0.3}>
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-cryptoindex-soft/20 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-cryptoindex-soft" />
              </div>
              <div className="space-y-2">
                <AnimatedGradientText className="text-lg font-semibold">
                  Connected!
                </AnimatedGradientText>
                <p className="text-cryptoindex-warm text-sm">
                  Your wallet has been successfully connected
                </p>
                <Badge className="bg-cryptoindex-soft/20 text-cryptoindex-soft border-cryptoindex-soft/30">
                  {walletOptions.find(w => w.id === selectedWallet)?.name} Connected
                </Badge>
              </div>
              <Button 
                onClick={handleClose}
                className="bg-cryptoindex-soft hover:bg-cryptoindex-highlight text-cryptoindex-primary"
              >
                Done
              </Button>
            </div>
          </BlurIn>
        );
      case 'error':
        return (
          <BlurIn duration={0.3}>
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <div className="space-y-2">
                <AnimatedGradientText className="text-lg font-semibold">
                  Connection Failed
                </AnimatedGradientText>
                <p className="text-cryptoindex-warm text-sm">
                  Failed to connect wallet. Please try again.
                </p>
              </div>
              <Button 
                onClick={() => setConnectionStatus('idle')}
                variant="outline"
                className="border-cryptoindex-accent text-cryptoindex-accent hover:bg-cryptoindex-accent hover:text-cryptoindex-primary"
              >
                Try Again
              </Button>
            </div>
          </BlurIn>
        );
      default:
        return (
          <BlurIn duration={0.3}>
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <AnimatedGradientText className="text-2xl font-bold">
                  Connect Wallet
                </AnimatedGradientText>
                <p className="text-cryptoindex-warm">
                  Choose a wallet to connect to CryptoIndex
                </p>
              </div>
              
              <div className="grid gap-4">
                {walletOptions.map((wallet, index) => (
                  <SlideIn key={wallet.id} direction="up" delay={index * 0.1}>
                    <CardSpotlight className="h-full">
                      <Ripple className="w-full h-full">
                        <Card 
                          className="cursor-pointer transition-all duration-200 hover:shadow-lg bg-cryptoindex-medium/20 border-cryptoindex-medium/30 hover:border-cryptoindex-highlight/50 h-full"
                          onClick={() => handleWalletSelect(wallet.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <motion.div 
                                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                    wallet.isPopular 
                                      ? 'bg-cryptoindex-soft/20' 
                                      : 'bg-cryptoindex-accent/20'
                                  }`}
                                  whileHover={{ scale: 1.1, rotate: 5 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                >
                                  <motion.div
                                    animate={{ 
                                      rotate: [0, 5, -5, 0],
                                      scale: [1, 1.05, 1]
                                    }}
                                    transition={{ 
                                      duration: 2, 
                                      repeat: Infinity, 
                                      repeatDelay: 3,
                                      ease: "easeInOut" 
                                    }}
                                  >
                                    <wallet.icon className={`w-6 h-6 ${
                                      wallet.isPopular 
                                        ? 'text-cryptoindex-soft' 
                                        : 'text-cryptoindex-accent'
                                    }`} />
                                  </motion.div>
                                </motion.div>
                                <div>
                                  <h3 className="font-semibold text-cryptoindex-cream">
                                    {wallet.name}
                                  </h3>
                                  <p className="text-sm text-cryptoindex-warm">
                                    {wallet.description}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                {wallet.badge && (
                                  <Badge 
                                    variant="secondary" 
                                    className={`${
                                      wallet.isPopular 
                                        ? 'bg-cryptoindex-soft/20 text-cryptoindex-soft border-cryptoindex-soft/30' 
                                        : 'bg-cryptoindex-accent/20 text-cryptoindex-accent border-cryptoindex-accent/30'
                                    }`}
                                  >
                                    {wallet.badge}
                                  </Badge>
                                )}
                                <motion.div 
                                  className="w-2 h-2 rounded-full bg-cryptoindex-highlight"
                                  animate={{ 
                                    scale: [1, 1.2, 1],
                                    opacity: [0.7, 1, 0.7]
                                  }}
                                  transition={{ 
                                    duration: 1.5, 
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                  }}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Ripple>
                    </CardSpotlight>
                  </SlideIn>
                ))}
              </div>
              
              <div className="text-center">
                <p className="text-xs text-cryptoindex-warm">
                  New to wallets?{" "}
                  <span className="text-cryptoindex-highlight hover:underline cursor-pointer">
                    Setup guide
                  </span>
                </p>
              </div>
            </div>
          </BlurIn>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md bg-cryptoindex-primary border-cryptoindex-medium/50">
        <DialogHeader className="sr-only">
          <DialogTitle>Connect Wallet</DialogTitle>
        </DialogHeader>
        {renderConnectionStatus()}
      </DialogContent>
    </Dialog>
  );
}