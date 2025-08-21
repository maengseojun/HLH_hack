// components/deposit/DepositFlow.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  DollarSign, 
  Wallet, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Info,
  RefreshCw
} from 'lucide-react';

interface DepositFlowProps {
  walletAddress: string;
  onDepositComplete?: (transactionId: string) => void;
}

interface DepositInfo {
  walletAddress: string;
  arbitrumBalance: {
    usdc: string;
    raw: string;
  };
  hyperliquidBalance: string;
  allowance: string;
  config: {
    minAmount: number;
    maxAmount: number;
    usdcAddress: string;
    bridgeAddress: string;
  };
  bridgeStats: {
    totalDeposits: number;
    totalVolume: string;
    averageProcessingTime: number;
    successRate: number;
  };
  requirements: {
    minDeposit: number;
    maxDeposit: number;
    needsApproval: boolean;
  };
}

export default function DepositFlow({ walletAddress, onDepositComplete }: DepositFlowProps) {
  const { ready, authenticated, user } = usePrivy();
  const [step, setStep] = useState<'info' | 'amount' | 'approve' | 'confirm' | 'processing'>('info');
  const [depositInfo, setDepositInfo] = useState<DepositInfo | null>(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Fetch deposit information
  useEffect(() => {
    if (ready && authenticated && walletAddress) {
      fetchDepositInfo();
    }
  }, [ready, authenticated, walletAddress]);

  const fetchDepositInfo = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/deposit/initiate?wallet=${walletAddress}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch deposit info');
      }

      setDepositInfo(data.depositInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    setError(null);
  };

  const validateAmount = (): boolean => {
    if (!depositInfo) return false;

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return false;
    }

    if (amountNum < depositInfo.config.minAmount) {
      setError(`Minimum deposit is ${depositInfo.config.minAmount} USDC`);
      return false;
    }

    if (amountNum > depositInfo.config.maxAmount) {
      setError(`Maximum deposit is ${depositInfo.config.maxAmount} USDC`);
      return false;
    }

    const balance = parseFloat(depositInfo.arbitrumBalance.usdc);
    if (amountNum > balance) {
      setError(`Insufficient balance. You have ${balance} USDC`);
      return false;
    }

    return true;
  };

  const handleProceed = async () => {
    if (!validateAmount()) return;

    setLoading(true);
    setError(null);

    try {
      // Prepare deposit transaction
      const response = await fetch('/api/deposit/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          amount
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to prepare deposit');
      }

      const { preparation } = data;

      // Check if approval is needed
      if (preparation.needsApproval) {
        setStep('approve');
      } else {
        setStep('confirm');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!depositInfo) return;

    setLoading(true);
    setError(null);

    try {
      // Request approval from user's wallet
      const provider = (window as any).ethereum;
      if (!provider) {
        throw new Error('No Ethereum provider found');
      }

      const amountWei = parseFloat(amount) * 1000000; // USDC has 6 decimals
      
      const approvalTx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: depositInfo.config.usdcAddress,
          data: `0x095ea7b3000000000000000000000000${depositInfo.config.bridgeAddress.slice(2)}${amountWei.toString(16).padStart(64, '0')}`
        }]
      });

      console.log('Approval transaction:', approvalTx);
      setStep('confirm');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!depositInfo) return;

    setLoading(true);
    setError(null);

    try {
      // Execute deposit transaction
      const provider = (window as any).ethereum;
      if (!provider) {
        throw new Error('No Ethereum provider found');
      }

      const amountWei = parseFloat(amount) * 1000000; // USDC has 6 decimals
      
      const depositTx = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: depositInfo.config.usdcAddress,
          data: `0xa9059cbb000000000000000000000000${depositInfo.config.bridgeAddress.slice(2)}${amountWei.toString(16).padStart(64, '0')}`
        }]
      });

      setTxHash(depositTx);
      setStep('processing');

      // Confirm transaction with backend
      const response = await fetch('/api/deposit/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress,
          amount,
          txHash: depositTx
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to confirm deposit');
      }

      setTransactionId(data.transaction.id);
      onDepositComplete?.(data.transaction.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'info':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Arbitrum Balance</Label>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-semibold">
                    {depositInfo?.arbitrumBalance.usdc} USDC
                  </div>
                  <div className="text-xs text-gray-500">Available to deposit</div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Hyperliquid Balance</Label>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-semibold">
                    {depositInfo?.hyperliquidBalance} USDC
                  </div>
                  <div className="text-xs text-gray-500">Current balance</div>
                </div>
              </div>
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Minimum deposit: {depositInfo?.config.minAmount} USDC
                <br />
                Average processing time: {depositInfo?.bridgeStats.averageProcessingTime}s
                <br />
                Success rate: {depositInfo?.bridgeStats.successRate}%
              </AlertDescription>
            </Alert>

            <Button 
              onClick={() => setStep('amount')} 
              className="w-full"
              disabled={!depositInfo || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Continue to Deposit
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        );

      case 'amount':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Deposit Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="pl-10"
                  step="0.01"
                  min={depositInfo?.config.minAmount}
                  max={Math.min(
                    depositInfo?.config.maxAmount || 0,
                    parseFloat(depositInfo?.arbitrumBalance.usdc || '0')
                  )}
                />
                <div className="absolute right-3 top-3 text-sm text-gray-500">
                  USDC
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[25, 50, 100].map(presetAmount => (
                <Button
                  key={presetAmount}
                  variant="outline"
                  size="sm"
                  onClick={() => handleAmountChange(presetAmount.toString())}
                  disabled={presetAmount > parseFloat(depositInfo?.arbitrumBalance.usdc || '0')}
                >
                  {presetAmount}
                </Button>
              ))}
            </div>

            <div className="text-sm text-gray-600">
              Available: {depositInfo?.arbitrumBalance.usdc} USDC
            </div>

            <Button 
              onClick={handleProceed} 
              className="w-full"
              disabled={!amount || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  Proceed with Deposit
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        );

      case 'approve':
        return (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You need to approve the bridge contract to spend your USDC tokens.
                This is a one-time approval.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Amount to deposit:</span>
                <span className="font-semibold">{amount} USDC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Current allowance:</span>
                <span>{depositInfo?.allowance} USDC</span>
              </div>
            </div>

            <Button 
              onClick={handleApprove} 
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  Approve USDC
                  <CheckCircle className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">From:</span>
                <span className="text-sm font-medium">Arbitrum</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">To:</span>
                <span className="text-sm font-medium">Hyperliquid</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Amount:</span>
                <span className="text-sm font-medium">{amount} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Processing time:</span>
                <span className="text-sm font-medium">1-3 minutes</span>
              </div>
            </div>

            <Button 
              onClick={handleConfirm} 
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  Confirm Deposit
                  <CheckCircle className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        );

      case 'processing':
        return (
          <div className="space-y-4">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Processing Deposit</h3>
              <p className="text-sm text-gray-600">
                Your deposit is being processed. This may take a few minutes.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Amount:</span>
                <span className="font-semibold">{amount} USDC</span>
              </div>
              {txHash && (
                <div className="flex justify-between text-sm">
                  <span>Transaction:</span>
                  <a 
                    href={`https://arbiscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View on Arbiscan
                  </a>
                </div>
              )}
            </div>

            <Progress value={33} className="h-2" />
            <div className="text-xs text-gray-500 text-center">
              Processing on Arbitrum network...
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!ready || !authenticated) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            Please connect your wallet to start depositing
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Deposit USDC
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Arbitrum</Badge>
          <ArrowRight className="h-4 w-4" />
          <Badge variant="outline">Hyperliquid</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {renderStepContent()}

        {step !== 'info' && step !== 'processing' && (
          <div className="mt-4 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setStep(step === 'amount' ? 'info' : 'amount')}
              className="w-full"
            >
              Back
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}