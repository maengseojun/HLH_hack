// components/hyperliquid/NetworkOnboarding.tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, AlertCircle, Loader2 } from 'lucide-react';
import { useHyperliquidOnboarding, OnboardingStep } from '@/lib/hyperliquid/onboarding';

export default function NetworkOnboarding() {
  const {
    ready,
    authenticated,
    user,
    onboardingSteps,
    executeStep,
    runFullOnboarding,
    getOnboardingProgress,
  } = useHyperliquidOnboarding();

  const [executingStep, setExecutingStep] = useState<string | null>(null);

  const handleExecuteStep = async (stepId: string) => {
    setExecutingStep(stepId);
    try {
      await executeStep(stepId);
    } finally {
      setExecutingStep(null);
    }
  };

  const handleFullOnboarding = async () => {
    setExecutingStep('full');
    try {
      await runFullOnboarding();
    } finally {
      setExecutingStep(null);
    }
  };

  const getStepIcon = (step: OnboardingStep) => {
    if (executingStep === step.id || executingStep === 'full') {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStepBadge = (step: OnboardingStep) => {
    switch (step.status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-500">Complete</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  if (!ready) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <div className="text-gray-500">Loading...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const progress = getOnboardingProgress();
  const isComplete = progress === 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Hyperliquid Network Setup</span>
          {isComplete && (
            <Badge className="bg-green-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          )}
        </CardTitle>
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="text-sm text-gray-600">
            {progress}% Complete ({onboardingSteps.filter(s => s.status === 'completed').length}/{onboardingSteps.length} steps)
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {onboardingSteps.map((step, index) => (
          <div key={step.id} className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              {getStepIcon(step)}
              <div>
                <div className="font-medium">{step.title}</div>
                <div className="text-sm text-gray-600">{step.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStepBadge(step)}
              {step.status !== 'completed' && step.action && (
                <Button
                  onClick={() => handleExecuteStep(step.id)}
                  disabled={executingStep !== null}
                  variant="outline"
                  size="sm"
                >
                  {executingStep === step.id ? 'Processing...' : 'Execute'}
                </Button>
              )}
            </div>
          </div>
        ))}

        {!isComplete && (
          <div className="pt-4 border-t">
            <Button
              onClick={handleFullOnboarding}
              disabled={executingStep !== null}
              className="w-full"
            >
              {executingStep === 'full' ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting up Hyperliquid...
                </>
              ) : (
                'Complete Setup'
              )}
            </Button>
          </div>
        )}

        {isComplete && (
          <div className="pt-4 border-t">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                <div className="font-medium">Setup Complete!</div>
              </div>
              <div className="text-sm text-green-600 mt-1">
                Your wallet is now ready to use with Hyperliquid. You can start depositing and trading.
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <div className="text-xs text-gray-500">
            <div><strong>Current User:</strong> {user?.email?.email || 'N/A'}</div>
            <div><strong>Authentication:</strong> {authenticated ? 'Connected' : 'Disconnected'}</div>
            <div><strong>Wallet Type:</strong> {user?.linkedAccounts?.[0]?.type || 'N/A'}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}