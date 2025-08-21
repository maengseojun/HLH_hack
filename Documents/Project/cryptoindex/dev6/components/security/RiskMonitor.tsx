// components/security/RiskMonitor.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { checkWalletHyperliquidUsage, getCachedHyperliquidUsage, showMarginWarning } from '@/lib/hyperliquid/utils';
import { 
  AlertTriangle, 
  Shield, 
  TrendingUp, 
  Eye,
  ExternalLink,
  Info,
  CheckCircle,
  XCircle
} from 'lucide-react';

interface RiskMonitorProps {
  walletAddress: string;
  currentPlatformUsage?: {
    marginUsed: number;
    totalBalance: number;
    openPositions: number;
  };
}

interface ExternalUsageEstimate {
  estimatedMarginUsed: number;
  externalPlatformsDetected: string[];
  lastExternalActivity?: Date;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export default function RiskMonitor({ 
  walletAddress, 
  currentPlatformUsage 
}: RiskMonitorProps) {
  const [externalUsage, setExternalUsage] = useState<ExternalUsageEstimate | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (walletAddress) {
      checkExternalUsage();
    }
  }, [walletAddress]);

  const checkExternalUsage = async () => {
    setLoading(true);
    try {
      // Check for cached data first
      const cached = getCachedHyperliquidUsage(walletAddress);
      const now = new Date();
      const cacheAge = cached?.lastChecked ? now.getTime() - new Date(cached.lastChecked).getTime() : Infinity;
      const maxCacheAge = 5 * 60 * 1000; // 5 minutes

      let usageData;
      if (cached && cacheAge < maxCacheAge) {
        // Use cached data if recent
        usageData = cached;
      } else {
        // Fetch fresh data
        usageData = await checkWalletHyperliquidUsage(walletAddress);
      }

      // Determine risk level based on usage
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      const totalMarginUsed = (currentPlatformUsage?.marginUsed || 0) + usageData.estimatedMargin;
      const availableMargin = Math.max(0, (currentPlatformUsage?.totalBalance || 0) - totalMarginUsed);

      if (availableMargin < 50) riskLevel = 'critical';
      else if (availableMargin < 100) riskLevel = 'high';
      else if (usageData.platforms.length > 1) riskLevel = 'medium';

      setExternalUsage({
        estimatedMarginUsed: usageData.estimatedMargin,
        externalPlatformsDetected: usageData.platforms,
        lastExternalActivity: usageData.lastChecked ? new Date(usageData.lastChecked) : undefined,
        riskLevel
      });
    } catch (error) {
      console.error('Failed to check external usage:', error);
      // Fallback to minimal data
      setExternalUsage({
        estimatedMarginUsed: 0,
        externalPlatformsDetected: [],
        riskLevel: 'low'
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateAvailableMargin = () => {
    if (!currentPlatformUsage || !externalUsage) return 0;
    
    const totalUsed = currentPlatformUsage.marginUsed + externalUsage.estimatedMarginUsed;
    return Math.max(0, currentPlatformUsage.totalBalance - totalUsed);
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'low': return <CheckCircle className="h-4 w-4" />;
      case 'medium': return <Info className="h-4 w-4" />;
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'critical': return <XCircle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  if (!currentPlatformUsage) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Risk Warning Alert */}
      <Alert className="border-blue-200 bg-blue-50">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                🏦 Multi-Platform Usage Detected
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-blue-600 hover:text-blue-800"
              >
                {isExpanded ? 'Hide Details' : 'View Details'}
                <Eye className="h-3 w-3 ml-1" />
              </Button>
            </div>
            <p className="text-sm">
              You're using this wallet on multiple Hyperliquid platforms. 
              <strong> Margin is shared</strong> - please monitor your total exposure.
            </p>
          </div>
        </AlertDescription>
      </Alert>

      {/* Detailed Risk Monitor */}
      {isExpanded && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Portfolio Risk Analysis
              <Badge 
                className={`${getRiskLevelColor(externalUsage?.riskLevel || 'low')}`}
              >
                {getRiskIcon(externalUsage?.riskLevel || 'low')}
                {externalUsage?.riskLevel?.toUpperCase() || 'UNKNOWN'} RISK
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Platform Usage Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-blue-600 font-medium">Our Platform:</span>
                  <span className="font-bold">{currentPlatformUsage.marginUsed} USDC</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentPlatformUsage.openPositions} open positions
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-orange-600 font-medium">
                    External Platforms:
                    <Button variant="ghost" size="sm" onClick={checkExternalUsage}>
                      {loading ? '🔄' : '🔍'}
                    </Button>
                  </span>
                  <span className="font-bold">
                    ~{externalUsage?.estimatedMarginUsed || 0} USDC
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {externalUsage?.externalPlatformsDetected?.join(', ') || 'None detected'}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-600 font-medium">Available:</span>
                  <span className="font-bold text-green-600">
                    {calculateAvailableMargin()} USDC
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Free margin remaining
                </div>
              </div>
            </div>

            {/* Risk Warnings */}
            {externalUsage && externalUsage.riskLevel !== 'low' && (
              <Alert className={`border-orange-200 bg-orange-50`}>
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <div className="space-y-2">
                    <div className="font-medium">⚠️ Risk Factors Detected:</div>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      {calculateAvailableMargin() < 100 && (
                        <li>Low available margin ({calculateAvailableMargin()} USDC remaining)</li>
                      )}
                      {externalUsage.externalPlatformsDetected.length > 1 && (
                        <li>Multiple external platforms detected ({externalUsage.externalPlatformsDetected.length})</li>
                      )}
                      {externalUsage.lastExternalActivity && 
                       Date.now() - externalUsage.lastExternalActivity.getTime() < 60 * 60 * 1000 && (
                        <li>Recent external activity detected</li>
                      )}
                      {/* Add margin-specific warnings */}
                      {currentPlatformUsage && externalUsage && (() => {
                        const totalMargin = currentPlatformUsage.marginUsed + externalUsage.estimatedMarginUsed;
                        const warnings = showMarginWarning(totalMargin, calculateAvailableMargin());
                        return warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ));
                      })()}
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Recommendations */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">💡 Recommendations:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardContent className="p-3">
                    <div className="text-sm space-y-1">
                      <div className="font-medium text-blue-800">🔄 Monitor Regularly</div>
                      <div className="text-blue-700 text-xs">
                        Check this dashboard before opening new positions
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="border-green-200 bg-green-50/50">
                  <CardContent className="p-3">
                    <div className="text-sm space-y-1">
                      <div className="font-medium text-green-800">🔒 Consider Separation</div>
                      <div className="text-green-700 text-xs">
                        Use different wallets for different platforms
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* External Platform Links */}
            {externalUsage?.externalPlatformsDetected && 
             externalUsage.externalPlatformsDetected.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">🔗 Detected Platforms:</h4>
                <div className="flex flex-wrap gap-2">
                  {externalUsage.externalPlatformsDetected.map((platform, index) => (
                    <Badge key={index} variant="outline" className="flex items-center gap-1">
                      {platform}
                      <ExternalLink className="h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}