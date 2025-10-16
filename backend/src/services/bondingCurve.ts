// Bonding Curve Service - Price calculation for L3 indices

import { AppError } from '../utils/httpError.js';

/**
 * Bonding curve types
 */
export type CurveType = 'linear' | 'exponential' | 'sigmoid' | 'hybrid';

/**
 * Bonding curve parameters
 */
export interface BondingCurveParams {
  curveType: CurveType;
  
  // Linear parameters
  basePrice: number;          // Initial price
  linearSlope?: number;       // k1 for linear growth
  
  // Sigmoid parameters
  maxPrice?: number;          // L: Upper price limit
  sigmoidSlope?: number;      // k2: Sigmoid steepness
  midpoint?: number;          // x0: Inflection point
  
  // Hybrid parameters
  transitionPoint?: number;   // Supply threshold for linear→sigmoid
  
  // Reserve parameters
  reserveRatio?: number;      // For Bancor-style (0-1)
  
  // Target
  targetMarketCap: number;    // Graduation target
}

/**
 * Calculate price using Linear bonding curve
 * P = basePrice + k * supply
 */
function calculateLinearPrice(
  supply: number,
  params: BondingCurveParams
): number {
  const k = params.linearSlope || 0.0001;
  return params.basePrice + k * supply;
}

/**
 * Calculate price using Exponential bonding curve
 * P = basePrice * e^(k * supply)
 */
function calculateExponentialPrice(
  supply: number,
  params: BondingCurveParams
): number {
  const k = params.linearSlope || 0.00001;
  return params.basePrice * Math.exp(k * supply);
}

/**
 * Calculate price using Sigmoid bonding curve
 * P = L / (1 + e^(-k * (supply - midpoint)))
 */
function calculateSigmoidPrice(
  supply: number,
  params: BondingCurveParams
): number {
  const L = params.maxPrice || params.targetMarketCap / 10000;
  const k = params.sigmoidSlope || 0.0001;
  const x0 = params.midpoint || 10000;
  
  return L / (1 + Math.exp(-k * (supply - x0)));
}

/**
 * Calculate price using Hybrid bonding curve (Recommended)
 * Phase 1 (supply < transitionPoint): Linear
 * Phase 2 (supply >= transitionPoint): Sigmoid
 */
function calculateHybridPrice(
  supply: number,
  params: BondingCurveParams
): number {
  const transition = params.transitionPoint || 5000;
  
  if (supply < transition) {
    // Linear phase for fair initial distribution
    return calculateLinearPrice(supply, params);
  } else {
    // Sigmoid phase for stability and growth
    const sigmoidParams = {
      ...params,
      basePrice: calculateLinearPrice(transition, params), // Smooth transition
    };
    return calculateSigmoidPrice(supply, sigmoidParams);
  }
}

/**
 * Calculate buy price for a given supply
 */
export function calculateBuyPrice(
  currentSupply: number,
  amount: number,
  params: BondingCurveParams
): {
  pricePerToken: number;
  totalCost: number;
  averagePrice: number;
  newSupply: number;
} {
  let totalCost = 0;
  const newSupply = currentSupply + amount;
  
  // Calculate integral (area under curve)
  // For simplicity, use rectangular approximation
  const steps = Math.ceil(amount);
  const stepSize = amount / steps;
  
  for (let i = 0; i < steps; i++) {
    const supply = currentSupply + (i * stepSize);
    const price = getPriceAtSupply(supply, params);
    totalCost += price * stepSize;
  }
  
  const finalPrice = getPriceAtSupply(newSupply, params);
  const averagePrice = totalCost / amount;
  
  return {
    pricePerToken: finalPrice,
    totalCost,
    averagePrice,
    newSupply,
  };
}

/**
 * Calculate sell price for a given supply
 */
export function calculateSellPrice(
  currentSupply: number,
  amount: number,
  params: BondingCurveParams
): {
  pricePerToken: number;
  totalReturn: number;
  averagePrice: number;
  newSupply: number;
} {
  if (amount > currentSupply) {
    throw new AppError(400, {
      code: 'INSUFFICIENT_POSITION',
      message: 'Cannot sell more than current supply'
    });
  }
  
  let totalReturn = 0;
  const newSupply = currentSupply - amount;
  
  // Calculate integral (area under curve)
  const steps = Math.ceil(amount);
  const stepSize = amount / steps;
  
  for (let i = 0; i < steps; i++) {
    const supply = currentSupply - (i * stepSize);
    const price = getPriceAtSupply(supply, params);
    totalReturn += price * stepSize;
  }
  
  const finalPrice = getPriceAtSupply(newSupply, params);
  const averagePrice = totalReturn / amount;
  
  return {
    pricePerToken: finalPrice,
    totalReturn,
    averagePrice,
    newSupply,
  };
}

/**
 * Get price at specific supply level
 */
export function getPriceAtSupply(
  supply: number,
  params: BondingCurveParams
): number {
  switch (params.curveType) {
    case 'linear':
      return calculateLinearPrice(supply, params);
    case 'exponential':
      return calculateExponentialPrice(supply, params);
    case 'sigmoid':
      return calculateSigmoidPrice(supply, params);
    case 'hybrid':
      return calculateHybridPrice(supply, params);
    default:
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: `Unknown curve type: ${params.curveType}`
      });
  }
}

/**
 * Calculate current market cap
 */
export function calculateMarketCap(
  supply: number,
  params: BondingCurveParams
): number {
  const currentPrice = getPriceAtSupply(supply, params);
  return supply * currentPrice;
}

/**
 * Calculate progress to graduation target
 */
export function calculateGraduationProgress(
  currentMarketCap: number,
  targetMarketCap: number
): number {
  return Math.min((currentMarketCap / targetMarketCap) * 100, 100);
}

/**
 * Get default hybrid curve parameters (Recommended for MVP)
 */
export function getDefaultHybridParams(targetMarketCap: number): BondingCurveParams {
  return {
    curveType: 'hybrid',
    basePrice: 0.01,              // $0.01 starting price
    linearSlope: 0.00001,         // Gentle initial slope
    maxPrice: targetMarketCap / 5000,  // Price cap at 5000 tokens
    sigmoidSlope: 0.0002,         // Moderate sigmoid steepness
    midpoint: 7500,               // Inflection at 7500 tokens
    transitionPoint: 5000,        // Switch to sigmoid at 5000 tokens
    targetMarketCap,
  };
}

/**
 * Simulate price trajectory
 */
export function simulatePriceTrajectory(
  params: BondingCurveParams,
  maxSupply: number,
  steps: number = 100
): Array<{ supply: number; price: number; marketCap: number }> {
  const trajectory: Array<{ supply: number; price: number; marketCap: number }> = [];
  const stepSize = maxSupply / steps;
  
  for (let i = 0; i <= steps; i++) {
    const supply = i * stepSize;
    const price = getPriceAtSupply(supply, params);
    const marketCap = supply * price;
    
    trajectory.push({ supply, price, marketCap });
  }
  
  return trajectory;
}
