'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface BattleTheme {
  id: string;
  name: string;
  description: string;
  icon: string;
  tokens: string[];
  currentValue: number;
  votes: number;
}

interface VotingInterfaceProps {
  battleId: string;
  themes: [BattleTheme, BattleTheme];
  onVote: (themeId: string) => void;
  userVoted?: string;
  isActive: boolean;
}

export function StaticVotingInterface({ 
  battleId, 
  themes, 
  onVote, 
  userVoted,
  isActive 
}: VotingInterfaceProps) {
  const [themeA, themeB] = themes;
  const totalVotes = themeA.votes + themeB.votes;
  
  const getVotePercentage = (votes: number) => {
    if (totalVotes === 0) return 0;
    return (votes / totalVotes) * 100;
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
      {/* Battle Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Portfolio Rebalancing Vote</h1>
        <p className="text-muted-foreground">
          Choose which theme should receive increased allocation
        </p>
        <Badge variant={isActive ? "default" : "secondary"}>
          {isActive ? "Voting Active" : "Voting Closed"}
        </Badge>
      </div>

      {/* Battle Overview */}
      <div className="space-y-6">
        {/* Theme A */}
        <Card className={`transition-all hover:shadow-lg ${
          userVoted === themeA.id ? 'ring-2 ring-primary' : ''
        }`}>
          <CardHeader className="text-center">
            <div className="text-6xl mb-2">{themeA.icon}</div>
            <CardTitle className="text-2xl">{themeA.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{themeA.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Value */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Current Portfolio Value</p>
              <p className="text-2xl font-bold text-green-600">
                {formatValue(themeA.currentValue)}
              </p>
            </div>

            {/* Token List */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Tokens:</p>
              <div className="flex flex-wrap gap-1">
                {themeA.tokens.map((token) => (
                  <Badge key={token} variant="outline" className="text-xs">
                    {token}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Vote Count */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Votes</span>
                <span className="font-mono">{themeA.votes.toLocaleString()}</span>
              </div>
              <Progress 
                value={getVotePercentage(themeA.votes)} 
                className="h-2"
              />
              <p className="text-xs text-center text-muted-foreground">
                {getVotePercentage(themeA.votes).toFixed(1)}% of total votes
              </p>
            </div>

            {/* Vote Button */}
            <Button 
              onClick={() => onVote(themeA.id)}
              disabled={!isActive || !!userVoted}
              className="w-full"
              variant={userVoted === themeA.id ? "default" : "outline"}
            >
              {userVoted === themeA.id ? "✓ Voted" : "Vote for " + themeA.name}
            </Button>
          </CardContent>
        </Card>

        {/* VS Separator */}
        <div className="text-center py-6">
          <div className="text-4xl font-bold text-gray-300">VS</div>
        </div>

        {/* Theme B */}
        <Card className={`transition-all hover:shadow-lg ${
          userVoted === themeB.id ? 'ring-2 ring-primary' : ''
        }`}>
          <CardHeader className="text-center">
            <div className="text-6xl mb-2">{themeB.icon}</div>
            <CardTitle className="text-2xl">{themeB.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{themeB.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Value */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Current Portfolio Value</p>
              <p className="text-2xl font-bold text-green-600">
                {formatValue(themeB.currentValue)}
              </p>
            </div>

            {/* Token List */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Tokens:</p>
              <div className="flex flex-wrap gap-1">
                {themeB.tokens.map((token) => (
                  <Badge key={token} variant="outline" className="text-xs">
                    {token}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Vote Count */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Votes</span>
                <span className="font-mono">{themeB.votes.toLocaleString()}</span>
              </div>
              <Progress 
                value={getVotePercentage(themeB.votes)} 
                className="h-2"
              />
              <p className="text-xs text-center text-muted-foreground">
                {getVotePercentage(themeB.votes).toFixed(1)}% of total votes
              </p>
            </div>

            {/* Vote Button */}
            <Button 
              onClick={() => onVote(themeB.id)}
              disabled={!isActive || !!userVoted}
              className="w-full"
              variant={userVoted === themeB.id ? "default" : "outline"}
            >
              {userVoted === themeB.id ? "✓ Voted" : "Vote for " + themeB.name}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Battle Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Total Votes</p>
              <p className="text-2xl font-bold">{totalVotes.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your Vote</p>
              <div className="text-lg">
                {userVoted ? (
                  <Badge variant="default">
                    {themes.find(t => t.id === userVoted)?.name}
                  </Badge>
                ) : (
                  <Badge variant="outline">Not voted</Badge>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="mt-1">
                <Badge variant={isActive ? "default" : "secondary"}>
                  {isActive ? "Active" : "Closed"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rebalancing Impact */}
      {!isActive && totalVotes > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Rebalancing Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                When voting closes, the portfolio will be automatically rebalanced:
              </p>
              <ul className="text-sm space-y-1 ml-4 list-disc">
                <li>Winner receives 60% of loser's portfolio value</li>
                <li>Automatic execution through DEX aggregation</li>
                <li>Slippage protection up to 5%</li>
                <li>Emergency stop at 15% loss</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default StaticVotingInterface;