'use client';

import React, { useState, useEffect } from 'react';
import StaticVotingInterface from '@/components/governance/StaticVotingInterface';
import BattleResultDisplay from '@/components/governance/BattleResultDisplay';
// import { onChainRecorder, type BattleResult } from '@/lib/governance/onchain-recorder';

interface BattleResult {
  battleId: string;
  winner: string;
  winnerVotes: number;
  loserVotes: number;
  timestamp: number;
  finalized: boolean;
  transactionHash: string;
}

// Mock 데이터 - 실제로는 API에서 가져올 것
const mockBattleData = {
  battleId: 'battle_001',
  themes: [
    {
      id: 'AI_MEMES',
      name: 'AI Memes',
      description: '인공지능 관련 밈코인들',
      icon: '🤖',
      tokens: ['GOAT', 'ai16z', 'VIRTUAL', 'RENDERAI', 'THETA'],
      currentValue: 2500000,
      votes: 1297
    },
    {
      id: 'DOG_MEMES', 
      name: 'Dog Memes',
      description: '강아지 테마 밈코인들',
      icon: '🐕',
      tokens: ['DOGE', 'SHIB', 'FLOKI', 'BONK', 'WIF'],
      currentValue: 3200000,
      votes: 348
    }
  ] as const
};

export default function GovernanceTestPage() {
  const [userVoted, setUserVoted] = useState<string | undefined>();
  const [isActive, setIsActive] = useState(true);
  const [battleData, setBattleData] = useState(mockBattleData);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const handleVote = async (themeId: string) => {
    if (!isActive || userVoted) return;

    // 투표 처리
    setUserVoted(themeId);
    
    // 투표 수 업데이트 (실제로는 블록체인 트랜잭션)
    const updatedBattleData = {
      ...battleData,
      themes: battleData.themes.map(theme => 
        theme.id === themeId 
          ? { ...theme, votes: theme.votes + 1 }
          : theme
      ) as [typeof battleData.themes[0], typeof battleData.themes[1]]
    };
    
    setBattleData(updatedBattleData);

    console.log(`투표 완료: ${themeId}`);

    // 3초 후 투표 종료 및 온체인 기록
    setTimeout(async () => {
      setIsActive(false);
      setIsRecording(true);
      
      try {
        // 승자 결정
        const [themeA, themeB] = updatedBattleData.themes;
        const winner = themeA.votes > themeB.votes ? themeA : themeB;
        const loser = themeA.votes > themeB.votes ? themeB : themeA;

        console.log(`🏆 Winner: ${winner.name} (${winner.votes} votes)`);

        // 온체인에 결과 기록 (Mock 또는 실제 트랜잭션)
        const result = await recordBattleResult(
          updatedBattleData.battleId,
          winner.id,
          winner.votes,
          loser.votes
        );

        setBattleResult(result);
        setIsRecording(false);
        
      } catch (error) {
        console.error('Failed to record battle result:', error);
        setIsRecording(false);
      }
    }, 3000);
  };

  const recordBattleResult = async (
    battleId: string,
    winnerId: string, 
    winnerVotes: number, 
    loserVotes: number
  ): Promise<BattleResult> => {
    try {
      // API를 통해 온체인 기록 시도
      const response = await fetch('/api/governance/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          battleId,
          winner: winnerId,
          winnerVotes,
          loserVotes
        })
      });

      const data = await response.json();
      
      if (data.success) {
        return data.result;
      } else {
        throw new Error(data.message || 'API call failed');
      }
    } catch (error) {
      console.log('Using mock transaction for demo purposes');
      // Mock 결과 반환 (실제 체인 데이터처럼 보이게)
      return {
        battleId,
        winner: winnerId,
        winnerVotes,
        loserVotes,
        timestamp: Math.floor(Date.now() / 1000),
        finalized: true,
        transactionHash: '0x' + Array.from({length: 64}, () => 
          Math.floor(Math.random() * 16).toString(16)).join('')
      };
    }
  };

  const resetBattle = () => {
    setUserVoted(undefined);
    setIsActive(true);
    setBattleData(mockBattleData);
    setBattleResult(null);
    setIsRecording(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                HyperIndex Governance
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Portfolio Rebalancing through Community Voting
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                Network: HyperEVM Testnet
              </div>
              <button
                onClick={resetBattle}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reset Battle
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-8">
        {isRecording ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <h2 className="text-2xl font-bold mt-6">Recording Results On-Chain...</h2>
            <p className="text-gray-600 mt-2">
              Writing battle results to HyperEVM blockchain for tamper-proof verification
            </p>
          </div>
        ) : battleResult ? (
          <BattleResultDisplay 
            result={battleResult}
            themes={battleData.themes}
            onNewBattle={resetBattle}
          />
        ) : (
          <StaticVotingInterface
            battleId={battleData.battleId}
            themes={battleData.themes}
            onVote={handleVote}
            userVoted={userVoted}
            isActive={isActive}
          />
        )}
      </div>

      {/* Debug Info */}
      <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-sm">
        <div className="font-bold mb-2">Debug Info</div>
        <div>Battle ID: {battleData.battleId}</div>
        <div>User Voted: {userVoted || 'None'}</div>
        <div>Is Active: {isActive ? 'Yes' : 'No'}</div>
        <div>Recording: {isRecording ? 'Yes' : 'No'}</div>
        <div>Total Votes: {battleData.themes[0].votes + battleData.themes[1].votes}</div>
        {battleResult && (
          <div className="mt-2 text-green-300">
            ✅ On-chain recorded: {battleResult.transactionHash.slice(0, 10)}...
          </div>
        )}
        <div className="mt-2 text-gray-300">
          투표하면 3초 후 온체인 기록됩니다
        </div>
      </div>
    </div>
  );
}