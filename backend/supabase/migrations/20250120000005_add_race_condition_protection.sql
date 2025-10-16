-- Migration: 20250120000005_add_race_condition_protection
-- Description: Add constraints to prevent race conditions in funding rounds
-- Created: 2025-01-20

-- Add CHECK constraint to prevent target_raise overflow
-- This ensures current_raise never exceeds target_raise
ALTER TABLE funding_rounds
ADD CONSTRAINT check_current_raise_not_exceed_target
CHECK (current_raise <= target_raise);

-- Create function to safely update current_raise (atomic operation)
CREATE OR REPLACE FUNCTION increment_funding_round_raise(
  p_round_id UUID,
  p_amount NUMERIC
) RETURNS funding_rounds AS $$
DECLARE
  v_round funding_rounds;
BEGIN
  -- Lock the row for update
  UPDATE funding_rounds
  SET current_raise = current_raise + p_amount,
      status = CASE
        WHEN current_raise + p_amount >= target_raise THEN 'completed'
        ELSE status
      END
  WHERE id = p_round_id
    AND status = 'active'
    AND current_raise + p_amount <= target_raise -- Prevent overflow
  RETURNING * INTO v_round;
  
  -- Check if update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot update funding round: either not active, not found, or would exceed target';
  END IF;
  
  RETURN v_round;
END;
$$ LANGUAGE plpgsql;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION increment_funding_round_raise(UUID, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION increment_funding_round_raise(UUID, NUMERIC) TO authenticated;

-- Add index for concurrent access performance
-- Note: Removed CONCURRENTLY to allow execution within migration transaction
-- CONCURRENTLY is only needed for large tables in production with active traffic
CREATE INDEX IF NOT EXISTS idx_funding_rounds_active_status 
ON funding_rounds(id, status) 
WHERE status = 'active';

-- Comment
COMMENT ON FUNCTION increment_funding_round_raise IS 
'Safely increment funding round raise amount with race condition protection';

COMMENT ON INDEX idx_funding_rounds_active_status IS
'Optimizes queries filtering active funding rounds';

-- Verify
DO $$
BEGIN
  RAISE NOTICE '✅ Added race condition protection to funding_rounds';
END $$;
