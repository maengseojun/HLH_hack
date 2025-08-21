"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedGradientText, BlurIn, SlideIn, Ripple } from "@/components/magicui";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { BackgroundBeams } from "@/components/ui/background-beams";
import WalletConnectionDialog from "@/components/dialogs/wallet-connection-dialog";
import TradingDialog from "@/components/dialogs/trading-dialog";
import IndexDetailModal from "@/components/dialogs/index-detail-modal";
import SettingsDialog from "@/components/dialogs/settings-dialog";
import { ToastProvider, useToast, createSuccessToast, createWalletConnectedToast, createTradingToast, createPriceAlertToast } from "@/components/notifications/toast-system";
import { 
  Wallet, 
  TrendingUp, 
  BarChart3, 
  Settings, 
  Bell, 
  Zap,
  Sparkles,
  Layers,
  Smartphone,
  Monitor
} from "lucide-react";

interface DialogShowcaseProps {}

function DialogsShowcaseContent() {
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [tradingDialogOpen, setTradingDialogOpen] = useState(false);
  const [indexDetailOpen, setIndexDetailOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  
  const { addToast } = useToast();

  const demoCards = [
    {
      id: 'wallet',
      title: 'Wallet Connection',
      description: 'Connect your crypto wallet with CardSpotlight effects and Magic UI animations',
      features: ['CardSpotlight hover effects', 'Animated wallet icons', 'BlurIn animations', 'Connection progress'],
      icon: <Wallet className="w-6 h-6 text-cryptoindex-accent" />,
      action: () => setWalletDialogOpen(true)
    },
    {
      id: 'trading',
      title: 'Trading Interface',
      description: 'Professional trading dialog with BorderBeam and enhanced gradients',
      features: ['BorderBeam input fields', 'Enhanced BackgroundGradient', 'SparklesCore loading', 'Real-time calculations'],
      icon: <TrendingUp className="w-6 h-6 text-cryptoindex-accent" />,
      action: () => setTradingDialogOpen(true)
    },
    {
      id: 'index',
      title: 'Index Details',
      description: 'Comprehensive index modal with all UI libraries combined',
      features: ['OrbitingCircles tokens', 'AnimatedBeam connections', 'EvervaultCard effects', 'SparklesCore background'],
      icon: <BarChart3 className="w-6 h-6 text-cryptoindex-accent" />,
      action: () => setIndexDetailOpen(true)
    },
    {
      id: 'settings',
      title: 'Settings Panel',
      description: 'Interactive settings with Aceternity UI components',
      features: ['FloatingDock networks', 'EvervaultCard sections', 'Enhanced Ripple effects', 'Gradient switches'],
      icon: <Settings className="w-6 h-6 text-cryptoindex-accent" />,
      action: () => setSettingsDialogOpen(true)
    }
  ];

  const handleToastDemo = (type: string) => {
    switch (type) {
      case 'wallet':
        addToast(createWalletConnectedToast('0x1234...5678'));
        break;
      case 'trading':
        addToast(createTradingToast('buy', 'PEPE', '1000'));
        break;
      case 'alert':
        addToast(createPriceAlertToast('PEPE', 0.00001, 'up'));
        break;
      case 'success':
        addToast(createSuccessToast('Demo Success', 'All animations are working perfectly!'));
        break;
      default:
        addToast(createSuccessToast('Toast Demo', 'Magic UI animations in action!'));
    }
  };

  return (
    <div className="min-h-screen bg-cryptoindex-primary relative overflow-hidden">
      {/* Background Effects */}
      <BackgroundBeams className="absolute inset-0 opacity-30" />
      
      <div className="relative z-10 container mx-auto px-4 py-12">
        {/* Header */}
        <BlurIn duration={0.5}>
          <div className="text-center mb-12">
            <AnimatedGradientText className="text-5xl font-bold mb-4">
              CryptoIndex Dialogs
            </AnimatedGradientText>
            <p className="text-cryptoindex-warm text-lg max-w-2xl mx-auto">
              Showcase of enhanced dialogs combining shadcn/ui, Magic UI, and Aceternity UI 
              with CryptoIndex brand colors and animations
            </p>
            <div className="flex items-center justify-center space-x-4 mt-6">
              <Badge className="bg-cryptoindex-soft/20 text-cryptoindex-soft border-cryptoindex-soft/30">
                <Sparkles className="w-3 h-3 mr-1" />
                Magic UI
              </Badge>
              <Badge className="bg-cryptoindex-accent/20 text-cryptoindex-accent border-cryptoindex-accent/30">
                <Layers className="w-3 h-3 mr-1" />
                Aceternity UI
              </Badge>
              <Badge className="bg-cryptoindex-highlight/20 text-cryptoindex-highlight border-cryptoindex-highlight/30">
                <Monitor className="w-3 h-3 mr-1" />
                shadcn/ui
              </Badge>
            </div>
          </div>
        </BlurIn>

        {/* Demo Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {demoCards.map((card, index) => (
            <SlideIn key={card.id} direction="up" delay={index * 0.1}>
              <Ripple color="#898AC4" duration={0.8}>
                <Card className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 hover:bg-cryptoindex-medium/30 transition-all duration-300 transform hover:scale-[1.02] cursor-pointer h-full rounded-xl overflow-hidden">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-3 text-cryptoindex-cream">
                      <div className="p-3 rounded-lg bg-cryptoindex-accent/20">
                        {card.icon}
                      </div>
                      <span>{card.title}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-cryptoindex-warm">
                      {card.description}
                    </p>
                    <div className="space-y-2">
                      {card.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <Zap className="w-3 h-3 text-cryptoindex-accent" />
                          <span className="text-sm text-cryptoindex-warm">{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      onClick={card.action}
                      className="w-full bg-cryptoindex-accent hover:bg-cryptoindex-soft text-cryptoindex-cream font-semibold transition-all duration-300"
                    >
                      Open {card.title}
                    </Button>
                  </CardContent>
                </Card>
              </Ripple>
            </SlideIn>
          ))}
        </div>

        {/* Toast Demo Section */}
        <SlideIn direction="up" delay={0.4}>
          <Card className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 mb-12 rounded-xl overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center space-x-3 text-cryptoindex-cream">
                <Bell className="w-6 h-6 text-cryptoindex-accent" />
                <span>Toast Notifications Demo</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-cryptoindex-warm mb-6">
                Test the Magic UI powered toast notification system with different types and animations
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Ripple color="#898AC4">
                  <Button 
                    variant="outline"
                    onClick={() => handleToastDemo('wallet')}
                    className="border-cryptoindex-accent/50 text-cryptoindex-primary hover:bg-cryptoindex-accent/20 hover:text-cryptoindex-primary"
                  >
                    Wallet Connected
                  </Button>
                </Ripple>
                <Ripple color="#898AC4">
                  <Button 
                    variant="outline"
                    onClick={() => handleToastDemo('trading')}
                    className="border-cryptoindex-accent/50 text-cryptoindex-primary hover:bg-cryptoindex-accent/20 hover:text-cryptoindex-primary"
                  >
                    Trading Success
                  </Button>
                </Ripple>
                <Ripple color="#898AC4">
                  <Button 
                    variant="outline"
                    onClick={() => handleToastDemo('alert')}
                    className="border-cryptoindex-accent/50 text-cryptoindex-primary hover:bg-cryptoindex-accent/20 hover:text-cryptoindex-primary"
                  >
                    Price Alert
                  </Button>
                </Ripple>
                <Ripple color="#898AC4">
                  <Button 
                    variant="outline"
                    onClick={() => handleToastDemo('success')}
                    className="border-cryptoindex-accent/50 text-cryptoindex-primary hover:bg-cryptoindex-accent/20 hover:text-cryptoindex-primary"
                  >
                    Demo Toast
                  </Button>
                </Ripple>
              </div>
            </CardContent>
          </Card>
        </SlideIn>

        {/* Features Overview */}
        <SlideIn direction="up" delay={0.5}>
          <Card className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 rounded-xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-cryptoindex-cream">
                Enhanced Features & Animations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h3 className="font-semibold text-cryptoindex-cream">Magic UI Components</h3>
                  <ul className="space-y-1 text-sm text-cryptoindex-warm">
                    <li>• BlurIn & SlideIn animations</li>
                    <li>• AnimatedGradientText</li>
                    <li>• NumberTicker counters</li>
                    <li>• Ripple click effects</li>
                    <li>• BorderBeam highlights</li>
                    <li>• OrbitingCircles displays</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-cryptoindex-cream">Aceternity UI Effects</h3>
                  <ul className="space-y-1 text-sm text-cryptoindex-warm">
                    <li>• CardSpotlight hover effects</li>
                    <li>• EvervaultCard glitch effects</li>
                    <li>• BackgroundGradient animations</li>
                    <li>• SparklesCore particles</li>
                    <li>• FloatingDock navigation</li>
                    <li>• BackgroundBeams ambience</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-cryptoindex-cream">CryptoIndex Branding</h3>
                  <ul className="space-y-1 text-sm text-cryptoindex-warm">
                    <li>• Custom color palette integration</li>
                    <li>• Consistent design language</li>
                    <li>• Smooth transitions & timing</li>
                    <li>• Professional interactions</li>
                    <li>• Accessibility considerations</li>
                    <li>• Performance optimized</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      </div>

      {/* Dialog Components */}
      <WalletConnectionDialog 
        open={walletDialogOpen} 
        onOpenChange={setWalletDialogOpen} 
      />
      
      <TradingDialog 
        open={tradingDialogOpen} 
        onOpenChange={setTradingDialogOpen}
        initialToken="PEPE"
        initialAction="buy"
      />
      
      <IndexDetailModal 
        open={indexDetailOpen} 
        onOpenChange={setIndexDetailOpen} 
      />
      
      <SettingsDialog 
        open={settingsDialogOpen} 
        onOpenChange={setSettingsDialogOpen} 
      />
    </div>
  );
}

export default function DialogsShowcase(props: DialogShowcaseProps) {
  return (
    <ToastProvider>
      <DialogsShowcaseContent />
    </ToastProvider>
  );
}