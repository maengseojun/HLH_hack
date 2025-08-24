import { NextRequest, NextResponse } from 'next/server';
import { onChainRecorder } from '@/lib/governance/onchain-recorder';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const battleId = searchParams.get('battleId');
    const expectedWinner = searchParams.get('expectedWinner');

    if (!battleId || !expectedWinner) {
      return NextResponse.json(
        { error: 'Missing battleId or expectedWinner parameter' },
        { status: 400 }
      );
    }

    // 온체인 결과 조회
    const onChainResult = await onChainRecorder.getBattleResult(battleId);
    
    if (!onChainResult) {
      return NextResponse.json(
        { 
          verified: false,
          error: 'No on-chain result found',
          battleId 
        },
        { status: 404 }
      );
    }

    // 결과 검증
    const isValid = onChainResult.winner === expectedWinner && onChainResult.finalized;
    
    const verification = {
      verified: isValid,
      battleId,
      onChainResult: {
        winner: onChainResult.winner,
        winnerVotes: onChainResult.winnerVotes,
        loserVotes: onChainResult.loserVotes,
        timestamp: onChainResult.timestamp,
        finalized: onChainResult.finalized,
        transactionHash: onChainResult.transactionHash
      },
      expectedWinner,
      network: 'HyperEVM Testnet',
      chainId: 998,
      explorerUrl: `https://explorer.hyperliquid-testnet.xyz/tx/${onChainResult.transactionHash}`,
      verifiedAt: new Date().toISOString()
    };

    return NextResponse.json(verification);

  } catch (error) {
    console.error('Verification failed:', error);
    
    return NextResponse.json(
      { 
        verified: false,
        error: 'Verification failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { battleId, winner, winnerVotes, loserVotes } = body;

    if (!battleId || !winner || winnerVotes === undefined || loserVotes === undefined) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // 온체인에 결과 기록
    const result = await onChainRecorder.recordFinalResult(
      battleId,
      winner,
      winnerVotes,
      loserVotes
    );

    return NextResponse.json({
      success: true,
      result,
      network: 'HyperEVM Testnet',
      chainId: 998,
      explorerUrl: `https://explorer.hyperliquid-testnet.xyz/tx/${result.transactionHash}`,
      recordedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Recording failed:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Recording failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}