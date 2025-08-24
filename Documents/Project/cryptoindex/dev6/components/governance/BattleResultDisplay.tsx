'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Shield, Check } from 'lucide-react';

interface BattleResult {
  battleId: string;
  winner: string;
  winnerVotes: number;
  loserVotes: number;
  timestamp: number;
  finalized: boolean;
  transactionHash: string;
}

interface BattleTheme {
  id: string;
  name: string;
  description: string;
  icon: string;
  tokens: string[];
  currentValue: number;
  votes: number;
}

interface BattleResultDisplayProps {
  result: BattleResult;
  themes: [BattleTheme, BattleTheme];
  onNewBattle: () => void;
}

export function BattleResultDisplay({ 
  result, 
  themes, 
  onNewBattle 
}: BattleResultDisplayProps) {
  const [themeA, themeB] = themes;
  const totalVotes = result.winnerVotes + result.loserVotes;
  
  const winnerTheme = themes.find(t => t.id === result.winner);
  const loserTheme = themes.find(t => t.id !== result.winner);
  
  const getVotePercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return (votes / totalVotes) * 100;
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('ko-KR');
  };

  const getExplorerLink = (hash: string) => {
    return `https://explorer.hyperliquid-testnet.xyz/tx/${hash}`;
  };

  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Result Header */}
      <div className="text-center space-y-4">
        <Badge variant="secondary" className="text-lg px-4 py-2">
          <Check className="w-4 h-4 mr-2" />
          Battle Completed
        </Badge>
        
        <h1 className="text-4xl font-bold">
          🏆 {winnerTheme?.name} Wins!
        </h1>
        
        <div className="text-6xl mb-4">
          {winnerTheme?.icon}
        </div>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          {winnerTheme?.description} has won the community vote and will receive 
          increased portfolio allocation.
        </p>
      </div>

      {/* Vote Summary */}
      <Card className="border-2 border-green-200 bg-green-50/50">
        <CardHeader>
          <CardTitle className="text-center">Final Vote Count</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Winner */}
            <div className="text-center space-y-3">
              <div className="text-4xl">{winnerTheme?.icon}</div>
              <h3 className="text-xl font-semibold text-green-700">
                🏆 {winnerTheme?.name}
              </h3>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-green-600">
                  {result.winnerVotes.toLocaleString()}
                </div>
                <div className="text-lg font-medium text-green-600">
                  {getVotePercentage(result.winnerVotes).toFixed(1)}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div 
                    className="bg-green-500 h-4 rounded-full transition-all duration-1000"
                    style={{ width: `${getVotePercentage(result.winnerVotes)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Loser */}
            <div className="text-center space-y-3">
              <div className="text-4xl opacity-50">{loserTheme?.icon}</div>
              <h3 className="text-xl font-semibold text-gray-500">
                {loserTheme?.name}
              </h3>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-gray-500">
                  {result.loserVotes.toLocaleString()}
                </div>
                <div className="text-lg font-medium text-gray-500">
                  {getVotePercentage(result.loserVotes).toFixed(1)}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div 
                    className="bg-gray-400 h-4 rounded-full transition-all duration-1000"
                    style={{ width: `${getVotePercentage(result.loserVotes)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Total Stats */}
          <div className="mt-6 pt-6 border-t text-center">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Votes</p>
                <p className="text-2xl font-bold">{totalVotes.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vote Margin</p>
                <p className="text-2xl font-bold">
                  +{(result.winnerVotes - result.loserVotes).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* On-Chain Verification */}
      <Card className="border-2 border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2 text-blue-600" />
            On-Chain Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Network:</span>
            <Badge variant="outline">HyperEVM Testnet</Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="font-medium">Status:</span>
            <Badge variant="default" className="bg-green-600">
              <Check className="w-4 h-4 mr-1" />
              Immutably Recorded
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="font-medium">Recorded At:</span>
            <span className="font-mono text-sm">
              {formatTimestamp(result.timestamp)}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="font-medium">Transaction Hash:</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {result.transactionHash.slice(0, 10)}...{result.transactionHash.slice(-8)}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(getExplorerLink(result.transactionHash), '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                View
              </Button>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-yellow-800">
                  Tamper-Proof Result
                </p>
                <p className="text-sm text-yellow-700">
                  This voting result has been permanently recorded on the HyperEVM blockchain 
                  and cannot be modified by anyone, ensuring complete transparency and trust.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Impact */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Rebalancing Impact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-green-600 mb-2">
                📈 {winnerTheme?.name} (Winner)
              </h4>
              <ul className="space-y-1 text-sm">
                <li>• Receives 60% of losing team's assets</li>
                <li>• Current value: {formatValue(winnerTheme?.currentValue || 0)}</li>
                <li>• New allocation: ~38% → 55%</li>
                <li>• Tokens: {winnerTheme?.tokens.join(', ')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-red-600 mb-2">
                📉 {loserTheme?.name} (Loser)
              </h4>
              <ul className="space-y-1 text-sm">
                <li>• Loses 60% of portfolio allocation</li>
                <li>• Current value: {formatValue(loserTheme?.currentValue || 0)}</li>
                <li>• New allocation: ~28% → 11%</li>
                <li>• Tokens: {loserTheme?.tokens.join(', ')}</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 mb-2">
              Automatic Execution Details
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• DEX aggregation through 1inch for best prices</li>
              <li>• Maximum 5% slippage protection</li>
              <li>• Emergency halt at 15% unexpected loss</li>
              <li>• Transaction batching for gas optimization</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="text-center">
        <Button onClick={onNewBattle} size="lg" className="px-8">
          Start New Battle
        </Button>
      </div>
    </div>
  );
}

export default BattleResultDisplay;