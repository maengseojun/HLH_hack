"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AnimatedGradientText, NumberTicker, Ripple } from "@/components/magicui";
import { EvervaultCard } from "@/components/ui/evervault-card";
import { FloatingDock } from "@/components/ui/floating-dock";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { 
  Settings, 
  Bell, 
  Globe, 
  Zap, 
  Shield, 
  Palette, 
  Volume2, 
  Eye, 
  Smartphone,
  Wallet,
  DollarSign,
  TrendingUp,
  Moon,
  Sun,
  Monitor
} from "lucide-react";

interface SettingsDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface SettingsState {
  notifications: {
    priceAlerts: boolean;
    tradingUpdates: boolean;
    portfolioChanges: boolean;
    news: boolean;
    emailNotifications: boolean;
    pushNotifications: boolean;
  };
  trading: {
    defaultSlippage: number;
    autoApproval: boolean;
    confirmTransactions: boolean;
    showAdvancedOptions: boolean;
  };
  display: {
    theme: 'light' | 'dark' | 'system';
    currency: 'USD' | 'EUR' | 'GBP' | 'BTC' | 'ETH';
    language: 'en' | 'ko' | 'zh' | 'ja';
    priceChangeDisplay: '24h' | '7d' | '30d';
  };
  network: {
    selectedNetwork: 'ethereum' | 'bsc' | 'polygon' | 'solana';
    rpcUrl: string;
    gasPrice: number;
  };
  security: {
    biometricAuth: boolean;
    sessionTimeout: number;
    autoLock: boolean;
    requirePasswordForTrades: boolean;
  };
}

const defaultSettings: SettingsState = {
  notifications: {
    priceAlerts: true,
    tradingUpdates: true,
    portfolioChanges: true,
    news: false,
    emailNotifications: true,
    pushNotifications: true,
  },
  trading: {
    defaultSlippage: 0.5,
    autoApproval: false,
    confirmTransactions: true,
    showAdvancedOptions: false,
  },
  display: {
    theme: 'dark',
    currency: 'USD',
    language: 'en',
    priceChangeDisplay: '24h',
  },
  network: {
    selectedNetwork: 'ethereum',
    rpcUrl: 'https://mainnet.infura.io/v3/...',
    gasPrice: 20,
  },
  security: {
    biometricAuth: false,
    sessionTimeout: 30,
    autoLock: true,
    requirePasswordForTrades: true,
  },
};

export default function SettingsDialog({ trigger, open, onOpenChange }: SettingsDialogProps) {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [activeSection, setActiveSection] = useState('notifications');

  const updateSetting = (section: keyof SettingsState, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const networkOptions = [
    { 
      title: "Ethereum", 
      icon: <div className="w-6 h-6 bg-cryptoindex-accent rounded-full flex items-center justify-center text-xs font-bold">ETH</div>,
      value: "ethereum",
      color: "#898AC4"
    },
    { 
      title: "BSC", 
      icon: <div className="w-6 h-6 bg-cryptoindex-soft rounded-full flex items-center justify-center text-xs font-bold">BSC</div>,
      value: "bsc",
      color: "#A2AADB"
    },
    { 
      title: "Polygon", 
      icon: <div className="w-6 h-6 bg-cryptoindex-highlight rounded-full flex items-center justify-center text-xs font-bold">POL</div>,
      value: "polygon",
      color: "#C0C9EE"
    },
    { 
      title: "Solana", 
      icon: <div className="w-6 h-6 bg-cryptoindex-warm rounded-full flex items-center justify-center text-xs font-bold">SOL</div>,
      value: "solana",
      color: "#DED3C4"
    }
  ];

  const sectionIcons = {
    notifications: <Bell className="w-4 h-4" />,
    trading: <TrendingUp className="w-4 h-4" />,
    display: <Palette className="w-4 h-4" />,
    network: <Globe className="w-4 h-4" />,
    security: <Shield className="w-4 h-4" />,
  };

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <EvervaultCard className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-cryptoindex-cream">Price Alerts</Label>
              <p className="text-xs text-cryptoindex-warm">
                Get notified when prices reach your target
              </p>
            </div>
            <Switch 
              checked={settings.notifications.priceAlerts}
              onCheckedChange={(checked) => updateSetting('notifications', 'priceAlerts', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-cryptoindex-cream">Trading Updates</Label>
              <p className="text-xs text-cryptoindex-warm">
                Notifications for completed trades
              </p>
            </div>
            <Switch 
              checked={settings.notifications.tradingUpdates}
              onCheckedChange={(checked) => updateSetting('notifications', 'tradingUpdates', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-cryptoindex-cream">Portfolio Changes</Label>
              <p className="text-xs text-cryptoindex-warm">
                Daily portfolio performance summaries
              </p>
            </div>
            <Switch 
              checked={settings.notifications.portfolioChanges}
              onCheckedChange={(checked) => updateSetting('notifications', 'portfolioChanges', checked)}
            />
          </div>
        </div>
      </EvervaultCard>
      
      <EvervaultCard className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 p-6">
        <div className="space-y-4">
          <h3 className="text-cryptoindex-cream font-medium">Delivery Methods</h3>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-cryptoindex-cream">Email Notifications</Label>
              <p className="text-xs text-cryptoindex-warm">
                Receive notifications via email
              </p>
            </div>
            <Switch 
              checked={settings.notifications.emailNotifications}
              onCheckedChange={(checked) => updateSetting('notifications', 'emailNotifications', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-cryptoindex-cream">Push Notifications</Label>
              <p className="text-xs text-cryptoindex-warm">
                Browser and mobile push notifications
              </p>
            </div>
            <Switch 
              checked={settings.notifications.pushNotifications}
              onCheckedChange={(checked) => updateSetting('notifications', 'pushNotifications', checked)}
            />
          </div>
        </div>
      </EvervaultCard>
    </div>
  );

  const renderTradingSettings = () => (
    <div className="space-y-6">
      <EvervaultCard className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 p-6">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-cryptoindex-cream">Default Slippage</Label>
              <Badge variant="outline" className="border-cryptoindex-accent/30 text-cryptoindex-accent">
                <NumberTicker value={settings.trading.defaultSlippage} suffix="%" />
              </Badge>
            </div>
            <Slider
              value={[settings.trading.defaultSlippage]}
              onValueChange={(value) => updateSetting('trading', 'defaultSlippage', value[0])}
              max={5}
              min={0.1}
              step={0.1}
              className="[&_[role=slider]]:bg-cryptoindex-accent"
            />
            <div className="flex justify-between text-xs text-cryptoindex-warm">
              <span>0.1%</span>
              <span>5%</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-cryptoindex-cream">Auto Approval</Label>
              <p className="text-xs text-cryptoindex-warm">
                Automatically approve token allowances
              </p>
            </div>
            <Switch 
              checked={settings.trading.autoApproval}
              onCheckedChange={(checked) => updateSetting('trading', 'autoApproval', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-cryptoindex-cream">Confirm Transactions</Label>
              <p className="text-xs text-cryptoindex-warm">
                Show confirmation dialog before trading
              </p>
            </div>
            <Switch 
              checked={settings.trading.confirmTransactions}
              onCheckedChange={(checked) => updateSetting('trading', 'confirmTransactions', checked)}
            />
          </div>
        </div>
      </EvervaultCard>
    </div>
  );

  const renderDisplaySettings = () => (
    <div className="space-y-6">
      <EvervaultCard className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-cryptoindex-cream">Theme</Label>
            <Select 
              value={settings.display.theme} 
              onValueChange={(value) => updateSetting('display', 'theme', value)}
            >
              <SelectTrigger className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center space-x-2">
                    <Sun className="w-4 h-4" />
                    <span>Light</span>
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center space-x-2">
                    <Moon className="w-4 h-4" />
                    <span>Dark</span>
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center space-x-2">
                    <Monitor className="w-4 h-4" />
                    <span>System</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-cryptoindex-cream">Display Currency</Label>
            <Select 
              value={settings.display.currency} 
              onValueChange={(value) => updateSetting('display', 'currency', value)}
            >
              <SelectTrigger className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
                <SelectItem value="BTC">BTC (₿)</SelectItem>
                <SelectItem value="ETH">ETH (Ξ)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label className="text-cryptoindex-cream">Language</Label>
            <Select 
              value={settings.display.language} 
              onValueChange={(value) => updateSetting('display', 'language', value)}
            >
              <SelectTrigger className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ko">한국어</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </EvervaultCard>
    </div>
  );

  const renderNetworkSettings = () => (
    <div className="space-y-6">
      <EvervaultCard className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-cryptoindex-cream">Network Selection</Label>
            <FloatingDock 
              items={networkOptions}
              desktopClassName="bg-cryptoindex-medium/20 border-cryptoindex-medium/30"
              mobileClassName="bg-cryptoindex-medium/20 border-cryptoindex-medium/30"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-cryptoindex-cream">Custom RPC URL</Label>
            <PlaceholdersAndVanishInput 
              placeholders={[
                "Enter custom RPC URL",
                "https://mainnet.infura.io/v3/...",
                "Custom endpoint URL"
              ]}
              value={settings.network.rpcUrl}
              onChange={(e) => updateSetting('network', 'rpcUrl', e.target.value)}
              className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 text-cryptoindex-cream"
            />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-cryptoindex-cream">Gas Price</Label>
              <Badge variant="outline" className="border-cryptoindex-accent/30 text-cryptoindex-accent">
                <NumberTicker value={settings.network.gasPrice} suffix=" gwei" />
              </Badge>
            </div>
            <Slider
              value={[settings.network.gasPrice]}
              onValueChange={(value) => updateSetting('network', 'gasPrice', value[0])}
              max={100}
              min={1}
              step={1}
              className="[&_[role=slider]]:bg-cryptoindex-accent"
            />
            <div className="flex justify-between text-xs text-cryptoindex-warm">
              <span>1 gwei</span>
              <span>100 gwei</span>
            </div>
          </div>
        </div>
      </EvervaultCard>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <EvervaultCard className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-cryptoindex-cream">Biometric Authentication</Label>
              <p className="text-xs text-cryptoindex-warm">
                Use fingerprint or face ID for quick access
              </p>
            </div>
            <Switch 
              checked={settings.security.biometricAuth}
              onCheckedChange={(checked) => updateSetting('security', 'biometricAuth', checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-cryptoindex-cream">Auto Lock</Label>
              <p className="text-xs text-cryptoindex-warm">
                Automatically lock app when inactive
              </p>
            </div>
            <Switch 
              checked={settings.security.autoLock}
              onCheckedChange={(checked) => updateSetting('security', 'autoLock', checked)}
            />
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-cryptoindex-cream">Session Timeout</Label>
              <Badge variant="outline" className="border-cryptoindex-accent/30 text-cryptoindex-accent">
                <NumberTicker value={settings.security.sessionTimeout} suffix=" min" />
              </Badge>
            </div>
            <Slider
              value={[settings.security.sessionTimeout]}
              onValueChange={(value) => updateSetting('security', 'sessionTimeout', value[0])}
              max={120}
              min={5}
              step={5}
              className="[&_[role=slider]]:bg-cryptoindex-accent"
            />
            <div className="flex justify-between text-xs text-cryptoindex-warm">
              <span>5 min</span>
              <span>120 min</span>
            </div>
          </div>
        </div>
      </EvervaultCard>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'notifications':
        return renderNotificationSettings();
      case 'trading':
        return renderTradingSettings();
      case 'display':
        return renderDisplaySettings();
      case 'network':
        return renderNetworkSettings();
      case 'security':
        return renderSecuritySettings();
      default:
        return renderNotificationSettings();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden bg-cryptoindex-primary border-cryptoindex-medium/50">
        <div className="relative">
          <BackgroundBeams className="absolute inset-0 opacity-10" />
          
          <DialogHeader className="relative z-10">
            <DialogTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5 text-cryptoindex-accent" />
              <AnimatedGradientText className="text-xl font-bold">
                Settings
              </AnimatedGradientText>
            </DialogTitle>
          </DialogHeader>

          <div className="relative z-10 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Sidebar */}
              <div className="space-y-2">
                {Object.entries(sectionIcons).map(([key, icon]) => (
                  <Ripple 
                    key={key}
                    color={activeSection === key ? "#898AC4" : "#C0C9EE"}
                    duration={0.6}
                  >
                    <button
                      onClick={() => setActiveSection(key)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 transform hover:scale-[1.02] ${
                        activeSection === key 
                          ? 'bg-cryptoindex-accent/20 text-cryptoindex-accent shadow-lg' 
                          : 'text-cryptoindex-warm hover:bg-cryptoindex-medium/20 hover:text-cryptoindex-cream'
                      }`}
                    >
                      {icon}
                      <span className="capitalize">{key}</span>
                    </button>
                  </Ripple>
                ))}
              </div>

              {/* Content */}
              <div className="md:col-span-3">
                <div className="overflow-y-auto max-h-[60vh] pr-2">
                  {renderContent()}
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="mt-6 flex justify-end">
              <Ripple 
                color="#A2AADB" 
                duration={0.8}
              >
                <BackgroundGradient 
                  className="rounded-lg p-[2px]"
                  containerClassName="rounded-lg"
                  animate={true}
                >
                  <Button
                    onClick={() => onOpenChange?.(false)}
                    className="bg-gradient-to-r from-cryptoindex-soft to-cryptoindex-highlight hover:from-cryptoindex-highlight hover:to-cryptoindex-soft text-cryptoindex-primary font-semibold px-8 transition-all duration-300 transform hover:scale-[1.05]"
                  >
                    Save Settings
                  </Button>
                </BackgroundGradient>
              </Ripple>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}