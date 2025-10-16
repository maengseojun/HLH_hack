// Trading service for AMM swaps
import { AppError } from '../utils/httpError.js';

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';

export interface SwapParams {
  userId: string;
  fromToken: string;
  toToken: string;
  amount: string;
  slippage?: number; // in basis points (default: 200 = 2%)
}

export interface SwapResult {
  orderId: string;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  executionPrice: string;
  slippage: string;
  fee: string;
  txHash?: string;
  timestamp: number;
}

export interface OrderParams {
  userId: string;
  pair: string;
  side: OrderSide;
  type: OrderType;
  amount: string;
  price?: string; // Required for limit orders
}

export interface Order {
  id: string;
  userId: string;
  pair: string;
  side: OrderSide;
  type: OrderType;
  amount: string;
  price?: string;
  filledAmount: string;
  status: 'pending' | 'filled' | 'partial' | 'cancelled';
  createdAt: number;
  updatedAt: number;
}

/**
 * Execute an AMM swap
 * @param params Swap parameters
 * @returns Swap result
 */
export async function executeSwap(params: SwapParams): Promise<SwapResult> {
  const { userId, fromToken, toToken, amount, slippage = 200 } = params;

  // Validate inputs
  if (!userId || !fromToken || !toToken || !amount) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Missing required parameters'
    });
  }

  if (parseFloat(amount) <= 0) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Amount must be greater than 0'
    });
  }

  // TODO: Implement actual AMM swap logic
  // 1. Check balance
  // 2. Calculate expected output using AMM formula (x * y = k)
  // 3. Check slippage tolerance
  // 4. Execute transaction on HyperCore
  // 5. Wait for confirmation

  // Mock result for now
  const mockPrice = 1.5;
  const fromAmount = parseFloat(amount);
  const toAmount = fromAmount * mockPrice;
  const fee = fromAmount * 0.003; // 0.3% fee

  return {
    orderId: `swap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    fromToken,
    toToken,
    fromAmount: amount,
    toAmount: toAmount.toFixed(6),
    executionPrice: mockPrice.toFixed(6),
    slippage: '0.05', // 0.05%
    fee: fee.toFixed(6),
    timestamp: Date.now()
  };
}

/**
 * Create a new order
 * @param params Order parameters
 * @returns Created order
 */
export async function createOrder(params: OrderParams): Promise<Order> {
  const { userId, pair, side, type, amount, price } = params;

  // Validate inputs
  if (!userId || !pair || !side || !type || !amount) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Missing required parameters'
    });
  }

  if (type === 'limit' && !price) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Price is required for limit orders'
    });
  }

  if (parseFloat(amount) <= 0) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Amount must be greater than 0'
    });
  }

  // TODO: Implement actual order creation logic
  // For market orders, execute immediately via AMM
  // For limit orders, add to orderbook

  const orderId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const order: Order = {
    id: orderId,
    userId,
    pair,
    side,
    type,
    amount,
    price,
    filledAmount: type === 'market' ? amount : '0',
    status: type === 'market' ? 'filled' : 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  return order;
}

/**
 * Get user's orders
 * @param userId User ID
 * @param status Optional status filter
 * @returns List of orders
 */
export async function getUserOrders(
  userId: string,
  status?: Order['status']
): Promise<Order[]> {
  if (!userId) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'User ID is required'
    });
  }

  // TODO: Query from database
  // For now, return mock data
  
  const mockOrders: Order[] = [
    {
      id: 'order-1',
      userId,
      pair: 'HYPE/USDC',
      side: 'buy',
      type: 'market',
      amount: '100',
      filledAmount: '100',
      status: 'filled',
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000
    }
  ];

  if (status) {
    return mockOrders.filter(o => o.status === status);
  }

  return mockOrders;
}

/**
 * Cancel an order
 * @param userId User ID
 * @param orderId Order ID
 * @returns Cancelled order
 */
export async function cancelOrder(userId: string, orderId: string): Promise<Order> {
  if (!userId || !orderId) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'User ID and Order ID are required'
    });
  }

  // TODO: Implement actual order cancellation
  // 1. Check if order belongs to user
  // 2. Check if order is cancellable (not filled)
  // 3. Remove from orderbook
  // 4. Update status in database

  throw new AppError(400, {
    code: 'BAD_REQUEST',
    message: 'Order not found or already filled'
  });
}

/**
 * Get AMM pool information
 * @param pair Trading pair (e.g., 'HYPE/USDC')
 * @returns Pool information
 */
export async function getPoolInfo(pair: string) {
  if (!pair) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Pair is required'
    });
  }

  // TODO: Query actual AMM pool data from HyperCore

  return {
    pair,
    token0: pair.split('/')[0],
    token1: pair.split('/')[1],
    reserve0: '1000000',
    reserve1: '1500000',
    totalLiquidity: '1224744.87', // sqrt(1000000 * 1500000)
    fee: '0.003', // 0.3%
    volume24h: '50000'
  };
}
