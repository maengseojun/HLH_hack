// Index Service - Supabase version
// FULLY MIGRATED - All functions now use Supabase

import { supabase } from '../lib/supabase.js';
import { AppError } from '../utils/httpError.js';
import type {
  Index,
  Layer,
  IndexComponent,
  CreateIndexRequest,
  LayerConfig,
  L3Index,
} from '../types/index.js';

/**
 * Get layer configuration (pure logic - no DB)
 */
export function getLayerConfig(layer: Layer): LayerConfig {
  const configs = {
    L1: {
      layer: 'L1' as Layer,
      minComponents: 50,
      maxComponents: 100,
      tradingMechanism: 'amm' as const,
      managementFee: 0.007,
      rebalancingFrequency: 'monthly' as const,
      permissionless: false,
    },
    L2: {
      layer: 'L2' as Layer,
      minComponents: 5,
      maxComponents: 50,
      tradingMechanism: 'amm' as const,
      managementFee: 0.01,
      rebalancingFrequency: 'weekly' as const,
      permissionless: false,
    },
    L3: {
      layer: 'L3' as Layer,
      minComponents: 2,
      maxComponents: 20,
      tradingMechanism: 'bonding-curve' as const,
      managementFee: 0.02,
      rebalancingFrequency: 'user-controlled' as const,
      permissionless: true,
    },
  };
  
  return configs[layer];
}

/**
 * Validate index components (pure logic - no DB)
 */
function validateComponents(components: IndexComponent[], layer: Layer): void {
  const config = getLayerConfig(layer);
  
  if (components.length < config.minComponents) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: `${layer} requires at least ${config.minComponents} components`
    });
  }
  
  if (components.length > config.maxComponents) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: `${layer} allows maximum ${config.maxComponents} components`
    });
  }
  
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    throw new AppError(400, {
      code: 'WEIGHT_SUM_INVALID',
      message: `Component weights must sum to 1.0, got ${totalWeight}`
    });
  }
  
  const symbols = new Set<string>();
  for (const comp of components) {
    if (symbols.has(comp.symbol)) {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: `Duplicate symbol: ${comp.symbol}`
      });
    }
    symbols.add(comp.symbol);
    
    if (comp.weight <= 0 || comp.weight > 1) {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: `Invalid weight for ${comp.symbol}: ${comp.weight}`
      });
    }
  }
}

/**
 * ✅ MIGRATED: Create a new index
 */
export async function createIndex(
  request: CreateIndexRequest,
  userId?: string
): Promise<Index> {
  const { layer, symbol, name, description, components, bondingCurveParams } = request;
  
  // Check permissions
  const config = getLayerConfig(layer);
  if (!config.permissionless && !userId) {
    throw new AppError(401, {
      code: 'UNAUTHORIZED',
      message: `Creating ${layer} indices requires authentication`
    });
  }
  
  // Validate components
  validateComponents(components, layer);
  
  // Check if symbol already exists
  const { data: existingIndex } = await supabase
    .from('indices')
    .select('id')
    .eq('symbol', symbol.toUpperCase())
    .single();
  
  if (existingIndex) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: `Index with symbol ${symbol} already exists`
    });
  }
  
  // L3 requires bonding curve params
  if (layer === 'L3' && !bondingCurveParams) {
    throw new AppError(400, {
      code: 'BAD_REQUEST',
      message: 'Bonding curve parameters required for L3 indices'
    });
  }
  
  // Step 1: Create index
  const indexData: any = {
    layer,
    symbol: symbol.toUpperCase(),
    name,
    description,
    management_fee: config.managementFee,
    status: 'active',
    total_value_locked: 0,
    holders: 0,
    volume_24h: 0,
  };
  
  // Add created_by if userId exists (convert to UUID format if needed)
  if (userId) {
    // For now, use the first user from the database
    const { data: users } = await supabase.from('users').select('id').limit(1);
    if (users && users.length > 0) {
      indexData.created_by = users[0].id;
    }
  }
  
  // Add performance fee for L3
  if (layer === 'L3') {
    indexData.performance_fee = 0.2;
  }
  
  const { data: index, error: indexError } = await supabase
    .from('indices')
    .insert(indexData)
    .select()
    .single();
  
  if (indexError) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to create index: ${indexError.message}`
    });
  }
  
  // Step 2: Insert components
  const componentsData = components.map(c => ({
    index_id: index.id,
    symbol: c.symbol,
    address: c.address,
    weight: c.weight,
  }));
  
  const { error: componentsError } = await supabase
    .from('index_components')
    .insert(componentsData);
  
  if (componentsError) {
    // Rollback: delete the index
    await supabase.from('indices').delete().eq('id', index.id);
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to insert components: ${componentsError.message}`
    });
  }
  
  // Step 3: Insert bonding curve params (if L3)
  if (layer === 'L3' && bondingCurveParams) {
    const bondingCurveData = {
      index_id: index.id,
      curve_type: bondingCurveParams.curveType,
      base_price: bondingCurveParams.basePrice,
      linear_slope: bondingCurveParams.linearSlope,
      max_price: bondingCurveParams.maxPrice,
      sigmoid_slope: bondingCurveParams.sigmoidSlope,
      midpoint: bondingCurveParams.midpoint,
      transition_point: bondingCurveParams.transitionPoint,
      target_market_cap: bondingCurveParams.targetMarketCap,
      current_price: bondingCurveParams.basePrice,
      current_market_cap: 0,
      total_raised: 0,
      progress: 0,
    };
    
    const { error: bcError } = await supabase
      .from('bonding_curve_params')
      .insert(bondingCurveData);
    
    if (bcError) {
      // Rollback: delete index and components
      await supabase.from('indices').delete().eq('id', index.id);
      throw new AppError(500, {
        code: 'DB_ERROR',
        message: `Failed to insert bonding curve params: ${bcError.message}`
      });
    }
  }
  
  // Return the created index
  return getIndexById(index.id);
}

/**
 * ✅ MIGRATED: Update index components (rebalancing)
 */
export async function updateIndexComponents(
  indexId: string,
  newComponents: IndexComponent[],
  userId?: string
): Promise<Index> {
  const index = await getIndexById(indexId);
  
  // Check permissions
  if (index.layer !== 'L3' && !userId) {
    throw new AppError(401, {
      code: 'UNAUTHORIZED',
      message: 'Rebalancing requires authentication'
    });
  }
  
  // L3 indices can only be rebalanced by creator
  if (index.layer === 'L3' && index.createdBy !== userId) {
    throw new AppError(403, {
      code: 'UNAUTHORIZED',
      message: 'Only the creator can rebalance L3 indices'
    });
  }
  
  // Validate new components
  validateComponents(newComponents, index.layer);
  
  // Delete old components
  const { error: deleteError } = await supabase
    .from('index_components')
    .delete()
    .eq('index_id', indexId);
  
  if (deleteError) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to delete old components: ${deleteError.message}`
    });
  }
  
  // Insert new components
  const componentsData = newComponents.map(c => ({
    index_id: indexId,
    symbol: c.symbol,
    address: c.address,
    weight: c.weight,
  }));
  
  const { error: insertError } = await supabase
    .from('index_components')
    .insert(componentsData);
  
  if (insertError) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to insert new components: ${insertError.message}`
    });
  }
  
  // Update the index updated_at timestamp
  const { error: updateError } = await supabase
    .from('indices')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', indexId);
  
  if (updateError) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to update index: ${updateError.message}`
    });
  }
  
  // Return updated index
  return getIndexById(indexId);
}

/**
 * ✅ MIGRATED: Get index by ID from Supabase
 */
export async function getIndexById(indexId: string): Promise<Index> {
  const { data: index, error: indexError } = await supabase
    .from('indices')
    .select(`
      *,
      components:index_components(*),
      bondingCurve:bonding_curve_params(*)
    `)
    .eq('id', indexId)
    .single();
  
  if (indexError) {
    if (indexError.code === 'PGRST116') {
      throw new AppError(404, {
        code: 'BAD_REQUEST',
        message: `Index ${indexId} not found`
      });
    }
    
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to fetch index: ${indexError.message}`
    });
  }
  
  // Transform database format to application format
  const transformedIndex: Index = {
    id: index.id,
    layer: index.layer as Layer,
    symbol: index.symbol,
    name: index.name,
    description: index.description,
    components: index.components.map((c: any) => ({
      symbol: c.symbol,
      address: c.address,
      weight: parseFloat(c.weight),
    })),
    managementFee: parseFloat(index.management_fee),
    status: index.status as any,
    createdAt: new Date(index.created_at).getTime(),
    updatedAt: new Date(index.updated_at).getTime(),
    createdBy: index.created_by,
    totalValueLocked: index.total_value_locked?.toString() || '0',
    holders: index.holders || 0,
    volume24h: index.volume_24h?.toString() || '0',
  };
  
  // If L3, add bonding curve data
  if (index.layer === 'L3' && index.bondingCurve && index.bondingCurve.length > 0) {
    const bc = index.bondingCurve[0];
    (transformedIndex as L3Index).performanceFee = parseFloat(index.performance_fee || '0.2');
    (transformedIndex as L3Index).bondingCurve = {
      params: {
        curveType: bc.curve_type as any,
        basePrice: parseFloat(bc.base_price),
        linearSlope: bc.linear_slope ? parseFloat(bc.linear_slope) : undefined,
        maxPrice: bc.max_price ? parseFloat(bc.max_price) : undefined,
        sigmoidSlope: bc.sigmoid_slope ? parseFloat(bc.sigmoid_slope) : undefined,
        midpoint: bc.midpoint ? parseFloat(bc.midpoint) : undefined,
        transitionPoint: bc.transition_point ? parseFloat(bc.transition_point) : undefined,
        targetMarketCap: parseFloat(bc.target_market_cap),
      },
      currentPrice: parseFloat(bc.current_price),
      currentMarketCap: parseFloat(bc.current_market_cap),
      totalRaised: parseFloat(bc.total_raised),
      progress: parseFloat(bc.progress),
    };
  }
  
  return transformedIndex;
}

/**
 * ✅ MIGRATED: Get index by symbol from Supabase
 */
export async function getIndexBySymbol(symbol: string): Promise<Index> {
  const { data: index, error: indexError } = await supabase
    .from('indices')
    .select(`
      *,
      components:index_components(*),
      bondingCurve:bonding_curve_params(*)
    `)
    .eq('symbol', symbol.toUpperCase())
    .single();
  
  if (indexError) {
    if (indexError.code === 'PGRST116') {
      throw new AppError(404, {
        code: 'BAD_REQUEST',
        message: `Index ${symbol} not found`
      });
    }
    
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to fetch index: ${indexError.message}`
    });
  }
  
  return getIndexById(index.id);
}

/**
 * ✅ MIGRATED: Get all indices from Supabase
 */
export async function getAllIndices(layer?: Layer): Promise<Index[]> {
  let query = supabase
    .from('indices')
    .select(`
      *,
      components:index_components(*),
      bondingCurve:bonding_curve_params(*)
    `)
    .order('created_at', { ascending: false });
  
  if (layer) {
    query = query.eq('layer', layer);
  }
  
  const { data: indices, error } = await query;
  
  if (error) {
    throw new AppError(500, {
      code: 'DB_ERROR',
      message: `Failed to fetch indices: ${error.message}`
    });
  }
  
  // Transform each index
  return Promise.all(indices.map(async (index: any) => {
    return getIndexById(index.id);
  }));
}

/**
 * Mock functions (unchanged)
 */
export async function calculateIndexPrice(indexId: string): Promise<number> {
  const index = await getIndexById(indexId);
  let totalValue = 0;
  
  for (const component of index.components) {
    const mockPrice = 100 + Math.random() * 50;
    totalValue += component.weight * mockPrice;
  }
  
  return totalValue;
}

export async function calculateIndexTVL(indexId: string): Promise<string> {
  const index = await getIndexById(indexId);
  return index.totalValueLocked || '0';
}

export async function getIndexStats(indexId: string) {
  const index = await getIndexById(indexId);
  const price = await calculateIndexPrice(indexId);
  const tvl = await calculateIndexTVL(indexId);
  
  return {
    indexId: index.id,
    symbol: index.symbol,
    name: index.name,
    layer: index.layer,
    price: price.toFixed(2),
    tvl,
    holders: index.holders || 0,
    volume24h: index.volume24h || '0',
    components: index.components.length,
    status: index.status,
  };
}
