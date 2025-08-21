"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BlurIn, 
  AnimatedGradientText, 
  SlideIn, 
  NumberTicker, 
  OrbitingCircles, 
  AnimatedBeam,
  Ripple 
} from "@/components/magicui";
import { EvervaultCard } from "@/components/ui/evervault-card";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { BackgroundGradient } from "@/components/ui/background-gradient";
import { SparklesCore } from "@/components/ui/sparkles";
import { Meteors } from "@/components/ui/meteors";
import { 
  TrendingUp, 
  TrendingDown, 
  PieChart, 
  BarChart3, 
  Target, 
  DollarSign, 
  Calendar,
  Star,
  Zap,
  Users,
  Shield,
  Activity
} from "lucide-react";

interface IndexData {
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
  totalSupply: number;
  performance: {
    '1D': number;
    '7D': number;
    '1M': number;
    '3M': number;
    '1Y': number;
    'ALL': number;
  };
  composition: Array<{
    symbol: string;
    name: string;
    weight: number;
    price: number;
    change24h: number;
  }>;
  backtest: {
    sharpeRatio: number;
    maxDrawdown: number;
    volatility: number;
    returns: number;
  };
}

const sampleIndexData: IndexData = {
  name: "Frog Index",
  symbol: "FROG",
  price: 24.67,
  change24h: 8.45,
  change7d: 12.34,
  marketCap: 15600000,
  volume24h: 2340000,
  totalSupply: 1000000,
  performance: {
    '1D': 8.45,
    '7D': 12.34,
    '1M': 23.67,
    '3M': 45.89,
    '1Y': 156.78,
    'ALL': 245.67
  },
  composition: [
    { symbol: "PEPE", name: "Pepe", weight: 40, price: 0.00000847, change24h: 12.34 },
    { symbol: "BRETT", name: "Brett", weight: 30, price: 0.1234, change24h: -5.67 },
    { symbol: "ANDY", name: "Andy", weight: 20, price: 0.0567, change24h: 8.91 },
    { symbol: "WOJAK", name: "Wojak", weight: 10, price: 0.0234, change24h: 15.67 }
  ],
  backtest: {
    sharpeRatio: 1.85,
    maxDrawdown: -12.5,
    volatility: 28.4,
    returns: 156.78
  }
};

interface IndexDetailModalProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  indexData?: IndexData;
}

export default function IndexDetailModal({
  trigger,
  open,
  onOpenChange,
  indexData = sampleIndexData
}: IndexDetailModalProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<keyof IndexData['performance']>('1M');
  
  // Refs for AnimatedBeam connections
  const containerRef = useRef<HTMLDivElement>(null);
  const sharpeRef = useRef<HTMLDivElement>(null);
  const drawdownRef = useRef<HTMLDivElement>(null);
  const volatilityRef = useRef<HTMLDivElement>(null);
  const returnsRef = useRef<HTMLDivElement>(null);
  
  const handleTrade = () => {
    // This would open the trading dialog
    console.log("Opening trading dialog...");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-cryptoindex-primary border-cryptoindex-medium/50">
        <div className="relative">
          {/* Background Effects */}
          <BackgroundBeams className="absolute inset-0 opacity-20" />
          
          <DialogHeader className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="relative w-16 h-16 rounded-full bg-cryptoindex-accent/20 flex items-center justify-center overflow-hidden">
                    <SparklesCore
                      id="index-sparkles"
                      background="transparent"
                      minSize={0.6}
                      maxSize={1.4}
                      particleDensity={50}
                      className="absolute inset-0 w-full h-full"
                      particleColor="#C0C9EE"
                      speed={2}
                    />
                    <span className="relative z-10 text-cryptoindex-accent font-bold text-lg">
                      {indexData.symbol.slice(0, 2)}
                    </span>
                  </div>
                </div>
                <div>
                  <BlurIn>
                    <AnimatedGradientText className="text-2xl font-bold">
                      {indexData.name}
                    </AnimatedGradientText>
                  </BlurIn>
                  <p className="text-cryptoindex-warm">{indexData.symbol}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center space-x-2">
                  <NumberTicker 
                    value={indexData.price} 
                    prefix="$" 
                    decimalPlaces={2}
                    className="text-2xl font-bold text-cryptoindex-cream"
                  />
                  <Badge 
                    variant={indexData.change24h > 0 ? "default" : "destructive"}
                    className={`${
                      indexData.change24h > 0 
                        ? "bg-cryptoindex-soft/20 text-cryptoindex-soft border-cryptoindex-soft/30" 
                        : "bg-red-500/20 text-red-400 border-red-500/30"
                    }`}
                  >
                    {indexData.change24h > 0 ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {Math.abs(indexData.change24h).toFixed(2)}%
                  </Badge>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="relative z-10 mt-6 space-y-6">
            {/* Key Metrics */}
            <SlideIn direction="up" delay={0.1}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <EvervaultCard className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 p-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <BarChart3 className="w-4 h-4 text-cryptoindex-accent" />
                      <span className="text-cryptoindex-warm text-sm">Market Cap</span>
                    </div>
                    <NumberTicker 
                      value={indexData.marketCap} 
                      prefix="$" 
                      className="text-lg font-semibold text-cryptoindex-cream"
                    />
                  </div>
                </EvervaultCard>

                <EvervaultCard className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 p-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-cryptoindex-accent" />
                      <span className="text-cryptoindex-warm text-sm">24h Volume</span>
                    </div>
                    <NumberTicker 
                      value={indexData.volume24h} 
                      prefix="$" 
                      className="text-lg font-semibold text-cryptoindex-cream"
                    />
                  </div>
                </EvervaultCard>

                <EvervaultCard className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 p-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Target className="w-4 h-4 text-cryptoindex-accent" />
                      <span className="text-cryptoindex-warm text-sm">Total Supply</span>
                    </div>
                    <NumberTicker 
                      value={indexData.totalSupply} 
                      className="text-lg font-semibold text-cryptoindex-cream"
                    />
                  </div>
                </EvervaultCard>

                <EvervaultCard className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 p-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Star className="w-4 h-4 text-cryptoindex-accent" />
                      <span className="text-cryptoindex-warm text-sm">7D Change</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <NumberTicker 
                        value={Math.abs(indexData.change7d)} 
                        suffix="%" 
                        className={`text-lg font-semibold ${
                          indexData.change7d > 0 ? 'text-cryptoindex-soft' : 'text-red-400'
                        }`}
                      />
                      {indexData.change7d > 0 ? (
                        <TrendingUp className="w-4 h-4 text-cryptoindex-soft" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  </div>
                </EvervaultCard>
              </div>
            </SlideIn>

            {/* Token Composition with Orbiting Circles */}
            <SlideIn direction="up" delay={0.2}>
              <Card className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 relative overflow-hidden">
                <Meteors number={20} />
                <CardHeader>
                  <CardTitle className="text-cryptoindex-cream flex items-center space-x-2">
                    <PieChart className="w-5 h-5 text-cryptoindex-accent" />
                    <span>Token Composition</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Orbiting Circles Visualization */}
                  <div className="relative h-48 flex items-center justify-center">
                    <div className="relative">
                      {indexData.composition.map((token, index) => (
                        <OrbitingCircles
                          key={token.symbol}
                          className="border-none bg-cryptoindex-accent/20"
                          duration={20 + index * 5}
                          delay={index * 5}
                          radius={60 + index * 25}
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cryptoindex-accent text-cryptoindex-cream text-xs font-bold">
                            {token.symbol.slice(0, 2)}
                          </div>
                        </OrbitingCircles>
                      ))}
                      {/* Center Circle */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-cryptoindex-soft/20 flex items-center justify-center">
                          <span className="text-cryptoindex-soft font-bold">
                            {indexData.symbol}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Token Details */}
                  <div className="grid gap-3">
                    {indexData.composition.map((token, index) => (
                      <SlideIn key={token.symbol} direction="left" delay={0.3 + index * 0.1}>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-cryptoindex-medium/10">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-cryptoindex-accent/20 flex items-center justify-center">
                              <span className="text-cryptoindex-accent text-xs font-bold">
                                {token.symbol.slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-cryptoindex-cream">
                                {token.name}
                              </p>
                              <p className="text-xs text-cryptoindex-warm">
                                {token.symbol}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center space-x-2">
                              <Badge className="bg-cryptoindex-soft/20 text-cryptoindex-soft border-cryptoindex-soft/30">
                                {token.weight}%
                              </Badge>
                              <NumberTicker 
                                value={token.price} 
                                prefix="$" 
                                decimalPlaces={token.price < 0.01 ? 8 : 4}
                                className="text-cryptoindex-cream text-sm"
                              />
                            </div>
                            <div className="flex items-center space-x-1 mt-1">
                              <span className={`text-xs ${
                                token.change24h > 0 ? 'text-cryptoindex-soft' : 'text-red-400'
                              }`}>
                                {token.change24h > 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                              </span>
                              {token.change24h > 0 ? (
                                <TrendingUp className="w-3 h-3 text-cryptoindex-soft" />
                              ) : (
                                <TrendingDown className="w-3 h-3 text-red-400" />
                              )}
                            </div>
                          </div>
                        </div>
                      </SlideIn>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </SlideIn>

            {/* Performance and Backtest Tabs */}
            <SlideIn direction="up" delay={0.4}>
              <Tabs defaultValue="performance" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-cryptoindex-medium/20">
                  <TabsTrigger 
                    value="performance" 
                    className="data-[state=active]:bg-cryptoindex-soft/20 data-[state=active]:text-cryptoindex-soft"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Performance
                  </TabsTrigger>
                  <TabsTrigger 
                    value="backtest" 
                    className="data-[state=active]:bg-cryptoindex-accent/20 data-[state=active]:text-cryptoindex-accent"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Backtest
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="performance" className="space-y-4">
                  <Card className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30">
                    <CardHeader>
                      <CardTitle className="text-cryptoindex-cream">
                        Historical Performance
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                        {Object.entries(indexData.performance).map(([period, value]) => (
                          <div key={period} className="text-center">
                            <p className="text-cryptoindex-warm text-sm mb-1">{period}</p>
                            <NumberTicker 
                              value={Math.abs(value)} 
                              suffix="%" 
                              className={`text-lg font-semibold ${
                                value > 0 ? 'text-cryptoindex-soft' : 'text-red-400'
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="backtest" className="space-y-4">
                  <div className="relative">
                    {/* Animated Beam Connections Container */}
                    <div className="absolute inset-0 pointer-events-none" ref={containerRef}>
                      <AnimatedBeam
                        containerRef={containerRef}
                        fromRef={sharpeRef}
                        toRef={returnsRef}
                        curvature={-30}
                        gradientStartColor="#898AC4"
                        gradientStopColor="#A2AADB"
                        duration={3}
                        pathOpacity={0.3}
                      />
                      <AnimatedBeam
                        containerRef={containerRef}
                        fromRef={drawdownRef}
                        toRef={volatilityRef}
                        curvature={30}
                        gradientStartColor="#C0C9EE"
                        gradientStopColor="#DED3C4"
                        duration={2.5}
                        pathOpacity={0.3}
                        delay={0.5}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                      <EvervaultCard 
                        ref={sharpeRef}
                        className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 p-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <Shield className="w-4 h-4 text-cryptoindex-accent" />
                            <span className="text-cryptoindex-warm">Sharpe Ratio</span>
                          </div>
                          <NumberTicker 
                            value={indexData.backtest.sharpeRatio} 
                            decimalPlaces={2}
                            className="text-xl font-semibold text-cryptoindex-cream"
                          />
                          <Progress 
                            value={indexData.backtest.sharpeRatio * 20} 
                            className="h-2"
                          />
                        </div>
                      </EvervaultCard>

                      <EvervaultCard 
                        ref={drawdownRef}
                        className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 p-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <TrendingDown className="w-4 h-4 text-red-400" />
                            <span className="text-cryptoindex-warm">Max Drawdown</span>
                          </div>
                          <NumberTicker 
                            value={Math.abs(indexData.backtest.maxDrawdown)} 
                            suffix="%" 
                            className="text-xl font-semibold text-red-400"
                          />
                          <Progress 
                            value={Math.abs(indexData.backtest.maxDrawdown) * 2} 
                            className="h-2"
                          />
                        </div>
                      </EvervaultCard>

                      <EvervaultCard 
                        ref={volatilityRef}
                        className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 p-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <Activity className="w-4 h-4 text-cryptoindex-accent" />
                            <span className="text-cryptoindex-warm">Volatility</span>
                          </div>
                          <NumberTicker 
                            value={indexData.backtest.volatility} 
                            suffix="%" 
                            className="text-xl font-semibold text-cryptoindex-cream"
                          />
                          <Progress 
                            value={indexData.backtest.volatility} 
                            className="h-2"
                          />
                        </div>
                      </EvervaultCard>

                      <EvervaultCard 
                        ref={returnsRef}
                        className="bg-cryptoindex-medium/20 border-cryptoindex-medium/30 p-4"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <Star className="w-4 h-4 text-cryptoindex-soft" />
                            <span className="text-cryptoindex-warm">Total Returns</span>
                          </div>
                          <NumberTicker 
                            value={indexData.backtest.returns} 
                            suffix="%" 
                            className="text-xl font-semibold text-cryptoindex-soft"
                          />
                          <Progress 
                            value={Math.min(indexData.backtest.returns, 100)} 
                            className="h-2"
                          />
                        </div>
                      </EvervaultCard>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </SlideIn>

            {/* Trade Button */}
            <SlideIn direction="up" delay={0.5}>
              <div className="flex justify-center">
                <Ripple 
                  color="#898AC4" 
                  duration={1.2}
                >
                  <BackgroundGradient 
                    className="rounded-lg p-[3px]"
                    containerClassName="rounded-lg"
                    animate={true}
                  >
                    <Button
                      onClick={handleTrade}
                      size="lg"
                      className="bg-gradient-to-r from-cryptoindex-primary via-cryptoindex-accent to-cryptoindex-primary hover:from-cryptoindex-accent hover:via-cryptoindex-highlight hover:to-cryptoindex-accent text-cryptoindex-cream font-semibold px-8 py-6 text-lg transition-all duration-500 transform hover:scale-[1.08] hover:shadow-2xl"
                    >
                      <div className="flex items-center space-x-2">
                        <Zap className="w-5 h-5" />
                        <span>Trade Now</span>
                      </div>
                    </Button>
                  </BackgroundGradient>
                </Ripple>
              </div>
            </SlideIn>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}