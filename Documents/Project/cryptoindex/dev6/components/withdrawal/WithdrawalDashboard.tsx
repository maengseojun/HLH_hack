// components/withdrawal/WithdrawalDashboard.tsx
'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Wallet, 
  CreditCard, 
  History, 
  Settings, 
  Shield, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Activity,
  Users
} from 'lucide-react';
import WithdrawalForm from './WithdrawalForm';
import WithdrawalHistory from './WithdrawalHistory';
import BehaviorTracker from '@/components/security/BehaviorTracker';
import { useToast } from '@/components/ui/use-toast';

interface WithdrawalDashboardProps {
  walletAddress: string;
  userEmail: string;
}

interface DashboardStats {
  totalWithdrawals: number;
  totalVolume: string;
  averageProcessingTime: number;
  successRate: number;
  pendingCount: number;
}

interface UserStatus {
  has2FA: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  tier: string;
  canUpgrade: boolean;
}

export default function WithdrawalDashboard({ walletAddress, userEmail }: WithdrawalDashboardProps) {
  const [activeTab, setActiveTab] = useState('withdraw');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [userStatus, setUserStatus] = useState<UserStatus | null>(null);
  const [limits, setLimits] = useState<any>(null);
  const [monitoringStats, setMonitoringStats] = useState<any>(null);
  const [behaviorAlerts, setBehaviorAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
    
    // Set up auto-refresh for monitoring stats
    const interval = setInterval(loadMonitoringStats, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [walletAddress]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const [statsRes, limitsRes, userStatusRes, monitoringRes] = await Promise.all([
        fetch('/api/withdrawal/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'statistics' })
        }),
        fetch('/api/withdrawal/limits?action=summary'),
        fetch('/api/auth/privy-mfa?action=status'),
        fetch('/api/withdrawal/monitor?action=stats')
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData.statistics.user);
        }
      }

      if (limitsRes.ok) {
        const limitsData = await limitsRes.json();
        if (limitsData.success) {
          setLimits(limitsData.summary);
        }
      }

      if (userStatusRes.ok) {
        const userStatusData = await userStatusRes.json();
        if (userStatusData.success) {
          setUserStatus({
            has2FA: userStatusData.mfa?.enabled || false,
            emailVerified: true, // Assume verified if they can access
            phoneVerified: userStatusData.mfa?.methods?.includes('sms') || false,
            tier: limitsData?.summary?.tier || 'basic',
            canUpgrade: limitsData?.summary?.upgradeOptions?.nextTier !== null
          });
        }
      }

      if (monitoringRes.ok) {
        const monitoringData = await monitoringRes.json();
        if (monitoringData.success) {
          setMonitoringStats(monitoringData.statistics);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonitoringStats = async () => {
    try {
      const response = await fetch('/api/withdrawal/monitor?action=stats');
      const data = await response.json();
      
      if (data.success) {
        setMonitoringStats(data.statistics);
      }
    } catch (error) {
      console.error('Failed to load monitoring stats:', error);
    }
  };

  const handleWithdrawalInitiated = (withdrawalData: any) => {
    // Track withdrawal in behavior analysis
    if (typeof window !== 'undefined' && (window as any).behaviorTracker) {
      (window as any).behaviorTracker.trackTransaction({
        type: 'withdrawal',
        amount: withdrawalData.amount,
        currency: 'USDC',
        network: 'hyperliquid',
        timestamp: new Date()
      });
    }
    
    // Refresh dashboard data
    loadDashboardData();
    
    // Switch to history tab to show the new withdrawal
    setActiveTab('history');
    
    toast({
      title: 'Withdrawal initiated',
      description: `Your withdrawal of ${withdrawalData.amount} USDC is being processed.`,
    });
  };

  const handleBehaviorAnomalyDetected = (anomaly: any) => {
    setBehaviorAlerts(prev => [anomaly, ...prev.slice(0, 4)]); // Keep last 5 alerts
    
    if (anomaly.severity === 'high' || anomaly.severity === 'critical') {
      toast({
        title: 'Security Alert',
        description: anomaly.description,
        variant: 'destructive'
      });
    }
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(num);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'vip': return 'bg-purple-100 text-purple-800';
      case 'premium': return 'bg-orange-100 text-orange-800';
      case 'verified': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSystemStatus = () => {
    if (!monitoringStats) return 'unknown';
    
    const { successRate, pendingWithdrawals, isRunning } = monitoringStats;
    
    if (!isRunning) return 'maintenance';
    if (successRate >= 98) return 'operational';
    if (successRate >= 95) return 'degraded';
    return 'major-issues';
  };

  const getSystemStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'bg-green-100 text-green-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      case 'major-issues': return 'bg-red-100 text-red-800';
      case 'maintenance': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Withdrawal Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your USDC withdrawals from Hyperliquid
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getTierBadgeColor(userStatus?.tier || 'basic')}>
            {userStatus?.tier?.toUpperCase() || 'BASIC'} TIER
          </Badge>
          {userStatus?.has2FA && (
            <Badge variant="secondary">
              <Shield className="h-3 w-3 mr-1" />
              2FA
            </Badge>
          )}
        </div>
      </div>

      {/* Behavior Tracker */}
      <BehaviorTracker 
        enabled={true}
        onAnomalyDetected={handleBehaviorAnomalyDetected}
      />

      {/* System Status */}
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <span>System Status:</span>
            <Badge className={getSystemStatusColor(getSystemStatus())}>
              {getSystemStatus().replace('-', ' ').toUpperCase()}
            </Badge>
          </div>
          {monitoringStats && (
            <div className="mt-2 text-sm">
              Success Rate: {monitoringStats.successRate}% | 
              Pending: {monitoringStats.pendingWithdrawals} | 
              Avg Processing: {formatTime(monitoringStats.averageProcessingTime)}
            </div>
          )}
        </AlertDescription>
      </Alert>

      {/* Behavior Alerts */}
      {behaviorAlerts.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="font-medium text-orange-800">Recent Security Alerts</div>
              {behaviorAlerts.slice(0, 2).map((alert, index) => (
                <div key={index} className="text-sm text-orange-700">
                  <Badge 
                    variant="outline" 
                    className={`mr-2 ${alert.severity === 'high' || alert.severity === 'critical' ? 'border-red-300 text-red-800' : 'border-yellow-300 text-yellow-800'}`}
                  >
                    {alert.severity.toUpperCase()}
                  </Badge>
                  {alert.title}
                </div>
              ))}
              {behaviorAlerts.length > 2 && (
                <div className="text-xs text-orange-600">
                  +{behaviorAlerts.length - 2} more alerts
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">
                  {stats ? stats.totalWithdrawals : 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total Withdrawals
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">
                  {stats ? formatCurrency(stats.totalVolume) : formatCurrency(0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Total Volume
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">
                  {stats ? formatTime(stats.averageProcessingTime) : '0s'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg Processing Time
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">
                  {stats ? `${stats.successRate}%` : '0%'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Success Rate
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Limits Overview */}
      {limits && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Your Limits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Daily</span>
                  <span>
                    {formatCurrency(limits.limits.daily.current)} / {formatCurrency(limits.limits.daily.max)}
                  </span>
                </div>
                <Progress 
                  value={(limits.limits.daily.current / limits.limits.daily.max) * 100} 
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(limits.limits.daily.remaining)} remaining
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Weekly</span>
                  <span>
                    {formatCurrency(limits.limits.weekly.current)} / {formatCurrency(limits.limits.weekly.max)}
                  </span>
                </div>
                <Progress 
                  value={(limits.limits.weekly.current / limits.limits.weekly.max) * 100} 
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(limits.limits.weekly.remaining)} remaining
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Monthly</span>
                  <span>
                    {formatCurrency(limits.limits.monthly.current)} / {formatCurrency(limits.limits.monthly.max)}
                  </span>
                </div>
                <Progress 
                  value={(limits.limits.monthly.current / limits.limits.monthly.max) * 100} 
                  className="h-2"
                />
                <div className="text-xs text-muted-foreground">
                  {formatCurrency(limits.limits.monthly.remaining)} remaining
                </div>
              </div>
            </div>
            
            {limits.upgradeOptions.nextTier && (
              <Alert className="mt-4">
                <TrendingUp className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <span>
                      Upgrade to {limits.upgradeOptions.nextTier} tier for higher limits
                    </span>
                    <Button variant="outline" size="sm">
                      Upgrade
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Security Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              {userStatus?.emailVerified ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              <span className="text-sm">Email Verified</span>
            </div>
            
            <div className="flex items-center gap-2">
              {userStatus?.phoneVerified ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              <span className="text-sm">Phone Verified</span>
            </div>
            
            <div className="flex items-center gap-2">
              {userStatus?.has2FA ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              <span className="text-sm">2FA Enabled</span>
            </div>
          </div>
          
          {!userStatus?.has2FA && (
            <Alert className="mt-4">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>Enable 2FA for enhanced security and better withdrawal limits</span>
                  <Button variant="outline" size="sm">
                    Enable 2FA
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="withdraw" className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Withdraw
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="withdraw" className="mt-6">
          <WithdrawalForm 
            walletAddress={walletAddress} 
            onWithdrawalInitiated={handleWithdrawalInitiated}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <WithdrawalHistory walletAddress={walletAddress} />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">Current Tier</h3>
                  <div className="flex items-center gap-2">
                    <Badge className={getTierBadgeColor(userStatus?.tier || 'basic')}>
                      {userStatus?.tier?.toUpperCase() || 'BASIC'}
                    </Badge>
                    {userStatus?.canUpgrade && (
                      <Button variant="outline" size="sm">
                        Upgrade Tier
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="font-medium">Security Settings</h3>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <Shield className="h-4 w-4 mr-2" />
                      {userStatus?.has2FA ? 'Manage 2FA' : 'Setup 2FA'}
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Users className="h-4 w-4 mr-2" />
                      Verify Phone Number
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Withdrawal Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-medium">Default Settings</h3>
                  <div className="text-sm text-muted-foreground">
                    Configure your default withdrawal settings to speed up future transactions.
                  </div>
                </div>
                
                <Button variant="outline" className="w-full">
                  Configure Preferences
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}