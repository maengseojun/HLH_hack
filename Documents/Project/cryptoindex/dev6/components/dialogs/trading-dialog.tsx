"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { NumberTicker, BorderBeam } from "@/components/magicui";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { SparklesCore } from "@/components/ui/sparkles";
import { ArrowUpDown, Settings, TrendingUp, TrendingDown, Zap, DollarSign } from "lucide-react";

interface TradingDialogProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialToken?: string;
  initialAction?: 'buy' | 'sell';
}

interface TokenData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  balance?: number;
}

const tokenData: Record<string, TokenData> = {
  "PEPE": {
    symbol: "PEPE",
    name: "Pepe",
    price: 0.00000847,
    change24h: 12.34,
    balance: 1000000
  },
  "BRETT": {
    symbol: "BRETT",
    name: "Brett",
    price: 0.1234,
    change24h: -5.67,
    balance: 500
  },
  "ANDY": {
    symbol: "ANDY",
    name: "Andy",
    price: 0.0567,
    change24h: 8.91,
    balance: 250
  },
  "ETH": {
    symbol: "ETH",
    name: "Ethereum",
    price: 3456.78,
    change24h: 2.45,
    balance: 0.5
  }
};

export default function TradingDialog({
  trigger,
  open,
  onOpenChange,
  initialToken = "PEPE",
  initialAction = 'buy'
}: TradingDialogProps) {
  const [activeTab, setActiveTab] = useState(initialAction);
  const [selectedToken, setSelectedToken] = useState(initialToken);
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState([0.5]);
  const [isLoading, setIsLoading] = useState(false);
  
  const token = tokenData[selectedToken];
  const estimatedValue = parseFloat(amount) * token.price;
  const estimatedTokens = parseFloat(amount) / token.price;

  const handleTrade = async () => {
    setIsLoading(true);
    // Simulate trade execution
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsLoading(false);
    onOpenChange?.(false);
  };

  const placeholders = [
    "Enter amount in USD",
    "How much do you want to trade?",
    "Enter trade amount",
    "Amount to trade",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg bg-cryptoindex-primary border-cryptoindex-medium/50">
        <DialogHeader>
          <DialogTitle className="text-cryptoindex-cream">
            Trade {token.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Token Info Card */}
          <Card className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-cryptoindex-accent/20 flex items-center justify-center">
                    <span className="text-cryptoindex-accent font-bold text-sm">
                      {token.symbol.slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-cryptoindex-cream">
                      {token.name}
                    </h3>
                    <p className="text-sm text-cryptoindex-warm">
                      {token.symbol}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-2">
                    <NumberTicker 
                      value={token.price} 
                      prefix="$" 
                      decimalPlaces={token.price < 0.01 ? 8 : 2}
                      className="text-cryptoindex-cream font-semibold"
                    />
                    <Badge 
                      variant={token.change24h > 0 ? "default" : "destructive"}
                      className={`${
                        token.change24h > 0 
                          ? "bg-cryptoindex-soft/20 text-cryptoindex-soft border-cryptoindex-soft/30" 
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                      }`}
                    >
                      {token.change24h > 0 ? (
                        <TrendingUp className="w-3 h-3 mr-1" />
                      ) : (
                        <TrendingDown className="w-3 h-3 mr-1" />
                      )}
                      {Math.abs(token.change24h).toFixed(2)}%
                    </Badge>
                  </div>
                  {token.balance && (
                    <p className="text-xs text-cryptoindex-warm mt-1">
                      Balance: {token.balance.toLocaleString()} {token.symbol}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Buy/Sell Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-cryptoindex-medium/20">
              <TabsTrigger 
                value="buy" 
                className="data-[state=active]:bg-cryptoindex-soft/20 data-[state=active]:text-cryptoindex-soft"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Buy
              </TabsTrigger>
              <TabsTrigger 
                value="sell" 
                className="data-[state=active]:bg-cryptoindex-accent/20 data-[state=active]:text-cryptoindex-accent"
              >
                <TrendingDown className="w-4 h-4 mr-2" />
                Sell
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="buy" className="space-y-4">
              <div className="space-y-4">
                {/* Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="buy-amount" className="text-cryptoindex-cream">
                    Amount (USD)
                  </Label>
                  <BorderBeam 
                    className="rounded-lg"
                    size={200}
                    duration={8}
                    colorFrom="#898AC4"
                    colorTo="#C0C9EE"
                    borderWidth={1.5}
                  >
                    <PlaceholdersAndVanishInput
                      placeholders={placeholders}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="bg-cryptoindex-medium/20 border-0 text-cryptoindex-cream placeholder:text-cryptoindex-warm focus:bg-cryptoindex-medium/30 transition-all duration-200"
                    />
                  </BorderBeam>
                </div>

                {/* Estimated Tokens */}
                {amount && (
                  <div className="bg-cryptoindex-medium/10 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-cryptoindex-warm text-sm">
                        You'll receive approximately:
                      </span>
                      <div className="flex items-center space-x-2">
                        <NumberTicker 
                          value={estimatedTokens} 
                          decimalPlaces={2}
                          className="text-cryptoindex-highlight font-semibold"
                        />
                        <span className="text-cryptoindex-cream text-sm">
                          {token.symbol}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Slippage Settings */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-cryptoindex-cream">
                      Slippage Tolerance
                    </Label>
                    <Badge variant="outline" className="border-cryptoindex-accent/30 text-cryptoindex-accent">
                      {slippage[0]}%
                    </Badge>
                  </div>
                  <Slider
                    value={slippage}
                    onValueChange={setSlippage}
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

                {/* Buy Button */}
                <BackgroundGradient 
                  className="rounded-lg p-[2px]"
                  containerClassName="rounded-lg"
                  animate={true}
                >
                  <Button
                    onClick={handleTrade}
                    disabled={!amount || isLoading}
                    className="w-full bg-gradient-to-r from-cryptoindex-soft to-cryptoindex-highlight hover:from-cryptoindex-highlight hover:to-cryptoindex-soft text-cryptoindex-primary font-semibold transition-all duration-300 transform hover:scale-[1.02]"
                  >
                    {isLoading ? (
                      <div className="relative flex items-center space-x-2">
                        <SparklesCore
                          id="buy-loading-sparkles"
                          background="transparent"
                          minSize={0.3}
                          maxSize={0.8}
                          particleDensity={15}
                          className="absolute inset-0 w-full h-full"
                          particleColor="#555879"
                          speed={3}
                        />
                        <div className="relative z-10 w-4 h-4 border-2 border-cryptoindex-primary border-t-transparent rounded-full animate-spin" />
                        <span className="relative z-10">Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <DollarSign className="w-4 h-4" />
                        <span>Buy {token.symbol}</span>
                      </div>
                    )}
                  </Button>
                </BackgroundGradient>
              </div>
            </TabsContent>
            
            <TabsContent value="sell" className="space-y-4">
              <div className="space-y-4">
                {/* Amount Input */}
                <div className="space-y-2">
                  <Label htmlFor="sell-amount" className="text-cryptoindex-cream">
                    Amount ({token.symbol})
                  </Label>
                  <BorderBeam 
                    className="rounded-lg"
                    size={200}
                    duration={8}
                    colorFrom="#898AC4"
                    colorTo="#C0C9EE"
                    borderWidth={1.5}
                  >
                    <PlaceholdersAndVanishInput
                      placeholders={[
                        `Enter ${token.symbol} amount`,
                        `How much ${token.symbol} to sell?`,
                        `${token.symbol} amount to sell`,
                      ]}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="bg-cryptoindex-medium/20 border-0 text-cryptoindex-cream placeholder:text-cryptoindex-warm focus:bg-cryptoindex-medium/30 transition-all duration-200"
                    />
                  </BorderBeam>
                  {token.balance && (
                    <p className="text-xs text-cryptoindex-warm">
                      Available: {token.balance.toLocaleString()} {token.symbol}
                    </p>
                  )}
                </div>

                {/* Estimated USD Value */}
                {amount && (
                  <div className="bg-cryptoindex-medium/10 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-cryptoindex-warm text-sm">
                        You'll receive approximately:
                      </span>
                      <div className="flex items-center space-x-2">
                        <NumberTicker 
                          value={estimatedValue} 
                          prefix="$"
                          decimalPlaces={2}
                          className="text-cryptoindex-highlight font-semibold"
                        />
                        <span className="text-cryptoindex-cream text-sm">
                          USD
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Slippage Settings */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-cryptoindex-cream">
                      Slippage Tolerance
                    </Label>
                    <Badge variant="outline" className="border-cryptoindex-accent/30 text-cryptoindex-accent">
                      {slippage[0]}%
                    </Badge>
                  </div>
                  <Slider
                    value={slippage}
                    onValueChange={setSlippage}
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

                {/* Sell Button */}
                <BackgroundGradient 
                  className="rounded-lg p-[2px]"
                  containerClassName="rounded-lg"
                  animate={true}
                >
                  <Button
                    onClick={handleTrade}
                    disabled={!amount || isLoading}
                    className="w-full bg-gradient-to-r from-cryptoindex-accent to-cryptoindex-medium hover:from-cryptoindex-medium hover:to-cryptoindex-accent text-cryptoindex-cream font-semibold transition-all duration-300 transform hover:scale-[1.02]"
                  >
                    {isLoading ? (
                      <div className="relative flex items-center space-x-2">
                        <SparklesCore
                          id="sell-loading-sparkles"
                          background="transparent"
                          minSize={0.3}
                          maxSize={0.8}
                          particleDensity={15}
                          className="absolute inset-0 w-full h-full"
                          particleColor="#F4EBD3"
                          speed={3}
                        />
                        <div className="relative z-10 w-4 h-4 border-2 border-cryptoindex-cream border-t-transparent rounded-full animate-spin" />
                        <span className="relative z-10">Processing...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Zap className="w-4 h-4" />
                        <span>Sell {token.symbol}</span>
                      </div>
                    )}
                  </Button>
                </BackgroundGradient>
              </div>
            </TabsContent>
          </Tabs>

          {/* Trade Summary */}
          <Card className="bg-cryptoindex-medium/10 border-cryptoindex-medium/20">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-cryptoindex-warm">Network</span>
                  <span className="text-cryptoindex-cream">Ethereum</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cryptoindex-warm">Gas Fee</span>
                  <span className="text-cryptoindex-cream">~$12.50</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-cryptoindex-warm">Slippage</span>
                  <span className="text-cryptoindex-cream">{slippage[0]}%</span>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-2 border-t border-cryptoindex-medium/20">
                  <span className="text-cryptoindex-cream">Total Cost</span>
                  <span className="text-cryptoindex-highlight">
                    ${(parseFloat(amount) || 0) + 12.50}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}