// components/withdrawal/WithdrawalForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Shield, 
  Wallet, 
  TrendingUp,
  Info,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const withdrawalSchema = z.object({
  amount: z.string().min(1, 'Amount is required').refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 1.01;
  }, 'Minimum withdrawal is 1.01 USDC'),
  destinationAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address'),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address')
});

type WithdrawalFormData = z.infer<typeof withdrawalSchema>;

interface WithdrawalFormProps {
  walletAddress: string;
  onWithdrawalInitiated: (withdrawalData: any) => void;
}

export default function WithdrawalForm({ walletAddress, onWithdrawalInitiated }: WithdrawalFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'form' | 'verification' | 'processing'>('form');
  const [limits, setLimits] = useState<any>(null);
  const [balance, setBalance] = useState<string>('0');
  const [fee, setFee] = useState<number>(1.0);
  const [validation, setValidation] = useState<any>(null);
  const [verificationData, setVerificationData] = useState<any>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    setValue,
    reset
  } = useForm<WithdrawalFormData>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      walletAddress: walletAddress,
      amount: '',
      destinationAddress: ''
    }
  });

  const watchedAmount = watch('amount');

  // Load user limits and balance on mount
  useEffect(() => {
    loadUserLimits();
    loadBalance();
  }, [walletAddress]);

  // Validate withdrawal amount in real-time
  useEffect(() => {
    if (watchedAmount && parseFloat(watchedAmount) >= 1.01) {
      validateWithdrawal();
    }
  }, [watchedAmount]);

  const loadUserLimits = async () => {
    try {
      const response = await fetch('/api/withdrawal/limits?action=summary');
      const data = await response.json();
      
      if (data.success) {
        setLimits(data.summary);
      }
    } catch (error) {
      console.error('Failed to load limits:', error);
    }
  };

  const loadBalance = async () => {
    try {
      const response = await fetch(`/api/withdrawal/initiate?wallet=${walletAddress}`);
      const data = await response.json();
      
      if (data.success) {
        setBalance(data.withdrawalInfo.balance.hyperliquid);
      }
    } catch (error) {
      console.error('Failed to load balance:', error);
    }
  };

  const validateWithdrawal = async () => {
    try {
      const amount = parseFloat(watchedAmount);
      const destinationAddress = watch('destinationAddress');
      
      if (!amount || !destinationAddress) return;

      const response = await fetch('/api/withdrawal/limits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'validate',
          amount,
          destinationAddress,
          walletAddress
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setValidation(data.validation);
      }
    } catch (error) {
      console.error('Failed to validate withdrawal:', error);
    }
  };

  const handleWithdrawalSubmit = async (data: WithdrawalFormData) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/withdrawal/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'prepare',
          ...data
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setVerificationData(result.preparation);
        setStep('verification');
        toast({
          title: 'Withdrawal prepared',
          description: 'Please verify your withdrawal request.',
        });
      } else {
        toast({
          title: 'Withdrawal failed',
          description: result.error || 'Failed to prepare withdrawal',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/withdrawal/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'verify',
          verificationId: verificationData.verification.id,
          verificationCode
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Execute withdrawal
        await executeWithdrawal();
      } else {
        toast({
          title: 'Verification failed',
          description: result.error || 'Invalid verification code',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Verification failed',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const executeWithdrawal = async () => {
    try {
      const response = await fetch('/api/withdrawal/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'execute',
          walletAddress: verificationData.walletAddress,
          amount: verificationData.amount,
          destinationAddress: verificationData.destinationAddress,
          signature: 'placeholder-signature', // In real app, this would be signed
          verificationId: verificationData.verification.id
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setStep('processing');
        onWithdrawalInitiated(result.transaction);
        toast({
          title: 'Withdrawal initiated',
          description: 'Your withdrawal is being processed',
        });
      } else {
        toast({
          title: 'Withdrawal failed',
          description: result.error || 'Failed to execute withdrawal',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to execute withdrawal',
        variant: 'destructive',
      });
    }
  };

  const calculateNetAmount = (amount: string) => {
    const gross = parseFloat(amount) || 0;
    return Math.max(0, gross - fee);
  };

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(amount);
  };

  if (step === 'form') {
    return (
      <div className="space-y-6">
        {/* Limits Overview */}
        {limits && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Withdrawal Limits
                <Badge variant="outline" className="ml-auto">
                  {limits.tier.toUpperCase()}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Daily</span>
                    <span>{formatCurrency(limits.limits.daily.current)} / {formatCurrency(limits.limits.daily.max)}</span>
                  </div>
                  <Progress 
                    value={(limits.limits.daily.current / limits.limits.daily.max) * 100} 
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Weekly</span>
                    <span>{formatCurrency(limits.limits.weekly.current)} / {formatCurrency(limits.limits.weekly.max)}</span>
                  </div>
                  <Progress 
                    value={(limits.limits.weekly.current / limits.limits.weekly.max) * 100} 
                    className="h-2"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Monthly</span>
                    <span>{formatCurrency(limits.limits.monthly.current)} / {formatCurrency(limits.limits.monthly.max)}</span>
                  </div>
                  <Progress 
                    value={(limits.limits.monthly.current / limits.limits.monthly.max) * 100} 
                    className="h-2"
                  />
                </div>
              </div>
              
              {limits.upgradeOptions.nextTier && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Upgrade to {limits.upgradeOptions.nextTier} tier for higher limits. 
                    Requirements: {limits.upgradeOptions.requirements.join(', ')}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Balance Display */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Available Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(parseFloat(balance))}</div>
            <div className="text-sm text-muted-foreground">USDC on Hyperliquid</div>
          </CardContent>
        </Card>

        {/* Withdrawal Form */}
        <Card>
          <CardHeader>
            <CardTitle>Withdraw Funds</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(handleWithdrawalSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USDC)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.000001"
                  placeholder="1.01"
                  {...register('amount')}
                />
                {errors.amount && (
                  <p className="text-sm text-red-500">{errors.amount.message}</p>
                )}
                {watchedAmount && (
                  <div className="text-sm text-muted-foreground">
                    Fee: {formatCurrency(fee)} | Net amount: {formatCurrency(calculateNetAmount(watchedAmount))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="destinationAddress">Destination Address</Label>
                <Input
                  id="destinationAddress"
                  placeholder="0x..."
                  {...register('destinationAddress')}
                />
                {errors.destinationAddress && (
                  <p className="text-sm text-red-500">{errors.destinationAddress.message}</p>
                )}
              </div>

              <input type="hidden" {...register('walletAddress')} />

              {/* Validation Results */}
              {validation && (
                <div className="space-y-2">
                  {validation.errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1">
                          {validation.errors.map((error: string, index: number) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {validation.warnings.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1">
                          {validation.warnings.map((warning: string, index: number) => (
                            <li key={index}>{warning}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={!isValid || isLoading || (validation && !validation.canProceed)}
              >
                {isLoading ? 'Processing...' : 'Prepare Withdrawal'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'verification') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Verify Withdrawal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span>Amount:</span>
              <span className="font-semibold">{formatCurrency(parseFloat(verificationData.amount))}</span>
            </div>
            <div className="flex justify-between">
              <span>Fee:</span>
              <span>{formatCurrency(verificationData.withdrawalFee)}</span>
            </div>
            <div className="flex justify-between">
              <span>Net Amount:</span>
              <span className="font-semibold">{formatCurrency(verificationData.netAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Destination:</span>
              <span className="font-mono text-sm">{verificationData.destinationAddress}</span>
            </div>
            <div className="flex justify-between">
              <span>Verification Method:</span>
              <Badge variant="outline">{verificationData.verification.method.toUpperCase()}</Badge>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {verificationData.verification.method === '2fa' 
                ? 'Enter your 2FA code from your authenticator app'
                : 'Enter the verification code sent to your email'
              }
            </AlertDescription>
          </Alert>

          <form onSubmit={handleVerificationSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verificationCode">Verification Code</Label>
              <Input
                id="verificationCode"
                type="text"
                placeholder="Enter code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('form')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={!verificationCode || isLoading}
                className="flex-1"
              >
                {isLoading ? 'Verifying...' : 'Verify & Execute'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (step === 'processing') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Withdrawal Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <div className="space-y-2">
              <h3 className="font-semibold">Processing your withdrawal...</h3>
              <p className="text-sm text-muted-foreground">
                This usually takes 3-4 minutes. You'll receive a notification when it's complete.
              </p>
            </div>
          </div>

          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Your withdrawal has been submitted successfully. You can track its progress in your transaction history.
            </AlertDescription>
          </Alert>

          <Button
            onClick={() => {
              setStep('form');
              reset();
              setVerificationData(null);
              setVerificationCode('');
            }}
            className="w-full"
          >
            Create New Withdrawal
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}