-- ====================================
-- trade_history 테이블에 누락된 컬럼 추가
-- V2 API 지원을 위한 추가 컬럼
-- ====================================

-- 1. side 컬럼 추가 (buy/sell)
ALTER TABLE trade_history 
ADD COLUMN IF NOT EXISTS side TEXT CHECK (side IN ('buy', 'sell'));

-- 2. user_id 컬럼 추가 (거래를 실행한 사용자 - V2 API용)
ALTER TABLE trade_history 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- 3. 기존 데이터에 대한 기본값 설정 (필요한 경우)
-- 기존 거래 기록에서 side 정보를 추론할 수 있다면 업데이트
UPDATE trade_history 
SET side = 'buy' 
WHERE side IS NULL AND buyer_order_id IS NOT NULL;

-- 4. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_trade_history_user_id ON trade_history(user_id);
CREATE INDEX IF NOT EXISTS idx_trade_history_side ON trade_history(side);

-- 5. 코멘트 추가
COMMENT ON COLUMN trade_history.side IS '거래 방향 (V2 API에서 사용)';
COMMENT ON COLUMN trade_history.user_id IS '거래를 실행한 사용자 ID (V2 API에서 사용)';

-- Migration 완료
SELECT 'Added missing columns to trade_history table!' as status;