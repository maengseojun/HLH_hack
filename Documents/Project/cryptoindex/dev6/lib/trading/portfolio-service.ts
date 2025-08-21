// lib/trading/portfolio-service.ts
import { createClient } from '@supabase/supabase-js';

interface Balance {
  tokenAddress: string;
  available: string;
  locked: string;
  total: string;
}

interface PortfolioSummary {
  totalValue: string;
  totalPnL: string;
  pnL24h: string;
  positions: Position[];
  balances: Balance[];
}

interface Position {
  tokenAddress: string;
  symbol: string;
  name: string;
  amount: string;
  averagePrice: string;
  currentPrice: string;
  totalCost: string;
  marketValue: string;
  unrealizedPnL: string;
  pnLPercentage: string;
  allocation: string; // Percentage of total portfolio
}

interface TradeUpdate {
  userId: string;
  tokenAddress: string;
  side: 'buy' | 'sell';
  amount: string;
  price: string;
}

export class PortfolioService {
  private static instance: PortfolioService;
  private supabase;

  private constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  static getInstance(): PortfolioService {
    if (!PortfolioService.instance) {
      PortfolioService.instance = new PortfolioService();
    }
    return PortfolioService.instance;
  }

  /**
   * Get user's complete portfolio
   */
  async getPortfolio(userId: string, userWalletAddress?: string): Promise<PortfolioSummary> {
    try {
      console.log(`🔄 Getting portfolio for user: ${userId}`);

      // Update balances and positions first
      if (userWalletAddress) {
        await this.syncBalancesFromBlockchain(userId, userWalletAddress);
      }

      // Get positions
      const positions = await this.getUserPositions(userId);
      
      // Get balances
      const balances = await this.getUserBalances(userId, userWalletAddress);
      
      // Calculate portfolio metrics
      const totalValue = this.calculateTotalValue(positions, balances);
      const totalPnL = this.calculateTotalPnL(positions);
      const pnL24h = await this.calculatePnL24h(userId);

      console.log(`✅ Portfolio retrieved: Total Value: $${totalValue}`);

      return {
        totalValue,
        totalPnL,
        pnL24h,
        positions,
        balances
      };

    } catch (_error) {
      console.error('❌ Failed to get portfolio:', _error);
      return {
        totalValue: '0',
        totalPnL: '0',
        pnL24h: '0',
        positions: [],
        balances: []
      };
    }
  }

  /**
   * Get user positions with current market data
   */
  async getUserPositions(userId: string): Promise<Position[]> {
    try {
      // Get positions from database
      const { data: dbPositions, error } = await this.supabase
        .from('trading_positions')
        .select(`
          *,
          index_tokens!inner(symbol, name, nav_per_token)
        `)
        .eq('user_id', userId)
        .gt('amount', 0); // Only show positions with balance > 0

      if (error) {
        console.error('❌ Failed to get positions from database:', _error);
        return [];
      }

      if (!dbPositions || dbPositions.length === 0) {
        return [];
      }

      // Enrich with current market data
      const positions: Position[] = await Promise.all(
        dbPositions.map(async (position) => {
          try {
            // Get current price from cached data or use NAV
            const currentPrice = position.index_tokens?.nav_per_token ? 
              parseFloat(position.index_tokens.nav_per_token) : 
              parseFloat(position.average_price); // Fallback to average price
            const amount = parseFloat(position.amount);
            const averagePrice = parseFloat(position.average_price);
            
            // Calculate metrics
            const totalCost = parseFloat(position.total_cost);
            const marketValue = amount * currentPrice;
            const unrealizedPnL = marketValue - totalCost;
            const pnLPercentage = totalCost > 0 ? ((unrealizedPnL / totalCost) * 100) : 0;

            return {
              tokenAddress: position.token_address,
              symbol: position.index_tokens?.symbol || 'UNKNOWN',
              name: position.index_tokens?.name || 'Unknown Token',
              amount: position.amount,
              averagePrice: averagePrice.toFixed(6),
              currentPrice: currentPrice.toFixed(6),
              totalCost: totalCost.toFixed(2),
              marketValue: marketValue.toFixed(2),
              unrealizedPnL: unrealizedPnL.toFixed(2),
              pnLPercentage: pnLPercentage.toFixed(2),
              allocation: '0' // Will be calculated later
            };
          } catch (_error) {
            console.error(`❌ Failed to process position for ${position.token_address}:`, _error);
            return {
              tokenAddress: position.token_address,
              symbol: position.symbol || 'ERROR',
              name: 'Error loading data',
              amount: position.amount,
              averagePrice: '0',
              currentPrice: '0',
              totalCost: '0',
              marketValue: '0',
              unrealizedPnL: '0',
              pnLPercentage: '0',
              allocation: '0'
            };
          }
        })
      );

      // Calculate allocation percentages
      const totalValue = positions.reduce((sum, pos) => sum + parseFloat(pos.marketValue), 0);
      
      positions.forEach(position => {
        const allocation = totalValue > 0 
          ? ((parseFloat(position.marketValue) / totalValue) * 100)
          : 0;
        position.allocation = allocation.toFixed(2);
      });

      return positions;

    } catch (_error) {
      console.error('❌ Failed to get user positions:', _error);
      return [];
    }
  }

  /**
   * Get user balances
   */
  async getUserBalances(userId: string, walletAddress?: string): Promise<Balance[]> {
    try {
      // Get cached balances from database
      const { data: cachedBalances } = await this.supabase
        .from('user_balances')
        .select(`
          token_address,
          symbol,
          available_balance,
          locked_balance,
          total_balance
        `)
        .eq('user_id', userId);

      if (!cachedBalances) {
        return [];
      }

      // Format as Balance objects
      return cachedBalances.map(balance => ({
        tokenAddress: balance.token_address,
        available: balance.available_balance,
        locked: balance.locked_balance,
        total: balance.total_balance
      }));

    } catch (_error) {
      console.error('❌ Failed to get user balances:', _error);
      return [];
    }
  }

  /**
   * Update position from trade execution
   */
  async updatePositionFromTrade(trade: TradeUpdate): Promise<void> {
    try {
      console.log(`🔄 Updating position from ${trade.side} trade:`, trade);

      const amount = parseFloat(trade.amount);
      const price = parseFloat(trade.price);
      const totalValue = amount * price;

      // Get current position
      const { data: currentPosition } = await this.supabase
        .from('trading_positions')
        .select('amount, average_price, total_cost')
        .eq('user_id', trade.userId)
        .eq('token_address', trade.tokenAddress)
        .single();

      let newAmount: number;
      let newAveragePrice: number;
      let newTotalCost: number;

      if (trade.side === 'buy') {
        if (currentPosition) {
          // Add to existing position
          const currentAmount = parseFloat(currentPosition.amount);
          const currentTotalCost = parseFloat(currentPosition.total_cost);
          
          newAmount = currentAmount + amount;
          newTotalCost = currentTotalCost + totalValue;
          newAveragePrice = newAmount > 0 ? newTotalCost / newAmount : 0;
        } else {
          // New position
          newAmount = amount;
          newTotalCost = totalValue;
          newAveragePrice = price;
        }
      } else {
        // Sell order
        if (currentPosition) {
          const currentAmount = parseFloat(currentPosition.amount);
          const currentTotalCost = parseFloat(currentPosition.total_cost);
          const currentAveragePrice = parseFloat(currentPosition.average_price);
          
          newAmount = Math.max(0, currentAmount - amount);
          
          if (newAmount > 0) {
            // Partial sell - reduce cost basis proportionally
            const soldRatio = amount / currentAmount;
            newTotalCost = currentTotalCost * (1 - soldRatio);
            newAveragePrice = currentAveragePrice; // Keep same average price
          } else {
            // Full sell
            newTotalCost = 0;
            newAveragePrice = 0;
          }

          // Record realized P&L
          const realizedPnL = (price - currentAveragePrice) * amount;
          await this.updateRealizedPnL(trade.userId, trade.tokenAddress, realizedPnL);
        } else {
          console.warn('⚠️ Sell order without existing position');
          return;
        }
      }

      // Update or insert position
      await this.supabase
        .from('trading_positions')
        .upsert({
          user_id: trade.userId,
          token_address: trade.tokenAddress,
          amount: newAmount.toString(),
          average_price: newAveragePrice.toString(),
          total_cost: newTotalCost.toString(),
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'user_id,token_address'
        });

      // Update balances
      await this.updateUserBalances(trade.userId);

      console.log(`✅ Position updated: ${newAmount} @ avg ${newAveragePrice}`);

    } catch (_error) {
      console.error('❌ Failed to update position from trade:', _error);
    }
  }

  /**
   * Sync balances from blockchain
   */
  async syncBalancesFromBlockchain(userId: string, walletAddress: string): Promise<void> {
    try {
      // Get all tradeable tokens from database
      const { data: tokens } = await this.supabase
        .from('index_tokens')
        .select('token_address');
      
      if (!tokens) return;
      
      // Add USDC for base currency
      const usdcAddress = '0xA0b86991c431C924b3c27dF22c2F7aD5e8b6d8E67';
      const allTokens = [...tokens.map(t => t.token_address), usdcAddress];

      // Mock balance data for now (replace with actual blockchain calls later)
      const balancePromises = allTokens.map(async (tokenAddress) => {
        try {
          // TODO: Implement actual blockchain balance fetching
          const balance = {
            available: '0.000000',
            locked: '0.000000', 
            total: '0.000000'
          };
          
          // Get token symbol
          const { data: tokenData } = await this.supabase
            .from('index_tokens')
            .select('symbol')
            .eq('token_address', tokenAddress)
            .single();

          const symbol = tokenData?.symbol || (tokenAddress === usdcAddress ? 'USDC' : 'UNKNOWN');

          return {
            tokenAddress,
            symbol,
            balance
          };
        } catch (_error) {
          console.error(`❌ Failed to get balance for ${tokenAddress}:`, _error);
          return null;
        }
      });

      const balances = (await Promise.all(balancePromises)).filter(b => b !== null);

      // Update database
      for (const balanceData of balances) {
        if (!balanceData) continue;

        await this.supabase
          .from('user_balances')
          .upsert({
            user_id: userId,
            token_address: balanceData.tokenAddress,
            symbol: balanceData.symbol,
            available_balance: balanceData.balance.available,
            locked_balance: balanceData.balance.locked,
            total_balance: balanceData.balance.total,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'user_id,token_address'
          });
      }

      console.log(`✅ Synced ${balances.length} token balances from blockchain`);

    } catch (_error) {
      console.error('❌ Failed to sync balances from blockchain:', _error);
    }
  }

  /**
   * Update user balances (called after trades)
   */
  async updateUserBalances(userId: string): Promise<void> {
    try {
      // This would typically refresh cached balances
      // For now, we'll just trigger a sync if wallet address is available
      console.log(`🔄 Updating balances for user: ${userId}`);
      
      // In a real implementation, you'd get the user's wallet address
      // and call syncBalancesFromBlockchain
      
    } catch (_error) {
      console.error('❌ Failed to update user balances:', _error);
    }
  }

  /**
   * Calculate total portfolio value
   */
  private calculateTotalValue(positions: Position[], balances: Balance[]): string {
    const positionsValue = positions.reduce((sum, pos) => sum + parseFloat(pos.marketValue), 0);
    
    // Add USDC balance (assuming it's 1:1 with USD)
    const usdcBalance = balances.find(b => b.tokenAddress.toLowerCase().includes('usdc'));
    const usdcValue = usdcBalance ? parseFloat(usdcBalance.available) : 0;
    
    return (positionsValue + usdcValue).toFixed(2);
  }

  /**
   * Calculate total unrealized P&L
   */
  private calculateTotalPnL(positions: Position[]): string {
    const totalPnL = positions.reduce((sum, pos) => sum + parseFloat(pos.unrealizedPnL), 0);
    return totalPnL.toFixed(2);
  }

  /**
   * Calculate 24h P&L change
   */
  private async calculatePnL24h(userId: string): Promise<string> {
    try {
      // Get portfolio snapshot from 24h ago
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const { data: snapshot } = await this.supabase
        .from('portfolio_snapshots')
        .select('total_value, pnl_total')
        .eq('user_id', userId)
        .lt('created_at', oneDayAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!snapshot) {
        return '0.00';
      }

      // Compare with current
      const currentPositions = await this.getUserPositions(userId);
      const currentPnL = parseFloat(this.calculateTotalPnL(currentPositions));
      const pastPnL = parseFloat(snapshot.pnl_total || '0');

      return (currentPnL - pastPnL).toFixed(2);

    } catch (_error) {
      console.error('❌ Failed to calculate 24h P&L:', _error);
      return '0.00';
    }
  }

  /**
   * Update realized P&L
   */
  private async updateRealizedPnL(userId: string, tokenAddress: string, realizedPnL: number): Promise<void> {
    try {
      await this.supabase
        .from('trading_positions')
        .update({
          realized_pnl: realizedPnL.toString()
        })
        .eq('user_id', userId)
        .eq('token_address', tokenAddress);

    } catch (_error) {
      console.error('❌ Failed to update realized P&L:', _error);
    }
  }

  /**
   * Create portfolio snapshot
   */
  async createPortfolioSnapshot(userId: string): Promise<void> {
    try {
      const portfolio = await this.getPortfolio(userId);
      
      await this.supabase
        .from('portfolio_snapshots')
        .insert({
          user_id: userId,
          total_value: portfolio.totalValue,
          positions: portfolio.positions,
          pnl_24h: portfolio.pnL24h,
          pnl_total: portfolio.totalPnL
        });

    } catch (_error) {
      console.error('❌ Failed to create portfolio snapshot:', _error);
    }
  }
}

export default PortfolioService;