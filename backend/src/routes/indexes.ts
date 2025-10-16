// Index routes - API endpoints for index management
// ✅ FULLY MIGRATED - All functions now use Supabase

import { Router } from 'express';

// ✅ ALL functions from Supabase now!
import {
  createIndex,
  getAllIndices,
  getIndexById,
  getIndexBySymbol,
  updateIndexComponents,
  getIndexStats,
  getLayerConfig,
} from '../services/index.supabase.js';

import type { CreateIndexRequest, Layer } from '../types/index.js';
import { AppError } from '../utils/httpError.js';

export const indexRouter = Router();

// Note: No more initializeDefaultIndices() - data is in Supabase!

/**
 * GET /v1/indexes
 * Get all indices, optionally filtered by layer
 * ✅ Using Supabase
 */
indexRouter.get('/', async (req, res, next) => {
  try {
    const layer = req.query.layer as Layer | undefined;
    
    // Validate layer if provided
    if (layer && !['L1', 'L2', 'L3'].includes(layer)) {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: 'Invalid layer. Must be L1, L2, or L3'
      });
    }
    
    const indices = await getAllIndices(layer);
    
    res.json({
      success: true,
      data: indices,
      count: indices.length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/indexes/:indexId
 * Get index by ID
 * ✅ Using Supabase
 */
indexRouter.get('/:indexId', async (req, res, next) => {
  try {
    const { indexId } = req.params;
    
    const index = await getIndexById(indexId);
    
    res.json({
      success: true,
      data: index
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/indexes/symbol/:symbol
 * Get index by symbol
 * ✅ Using Supabase
 */
indexRouter.get('/symbol/:symbol', async (req, res, next) => {
  try {
    const { symbol } = req.params;
    
    const index = await getIndexBySymbol(symbol);
    
    res.json({
      success: true,
      data: index
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/indexes/:indexId/stats
 * Get index statistics
 * ✅ Using Supabase
 */
indexRouter.get('/:indexId/stats', async (req, res, next) => {
  try {
    const { indexId } = req.params;
    
    const stats = await getIndexStats(indexId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /v1/indexes
 * Create a new index
 * ✅ Using Supabase
 */
indexRouter.post('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    
    const request: CreateIndexRequest = {
      layer: req.body.layer,
      symbol: req.body.symbol,
      name: req.body.name,
      description: req.body.description,
      components: req.body.components,
      bondingCurveParams: req.body.bondingCurveParams
    };
    
    // Validate required fields
    if (!request.layer || !request.symbol || !request.name || !request.components) {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: 'Missing required fields: layer, symbol, name, components'
      });
    }
    
    const index = await createIndex(request, userId);
    
    req.log?.info({ indexId: index.id }, 'Index created successfully');
    
    res.status(201).json({
      success: true,
      data: index
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /v1/indexes/:indexId/components
 * Update index components (rebalancing)
 * ✅ Using Supabase
 */
indexRouter.put('/:indexId/components', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { indexId } = req.params;
    const { components } = req.body;
    
    if (!components || !Array.isArray(components)) {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: 'Components array is required'
      });
    }
    
    const updatedIndex = await updateIndexComponents(indexId, components, userId);
    
    req.log?.info({ indexId }, 'Index components updated');
    
    res.json({
      success: true,
      data: updatedIndex
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /v1/indexes/layers/:layer/config
 * Get layer configuration
 * ✅ Using Supabase (pure function)
 */
indexRouter.get('/layers/:layer/config', async (req, res, next) => {
  try {
    const layer = req.params.layer as Layer;
    
    if (!['L1', 'L2', 'L3'].includes(layer)) {
      throw new AppError(400, {
        code: 'BAD_REQUEST',
        message: 'Invalid layer. Must be L1, L2, or L3'
      });
    }
    
    const config = getLayerConfig(layer);
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
});
