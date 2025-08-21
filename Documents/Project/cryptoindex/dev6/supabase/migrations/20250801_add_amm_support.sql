-- ====================================
-- AMM 지원을 위한 trade_history 확장
-- 기존 테이블에 컬럼 추가
-- ====================================

-- 1. AMM vs Orderbook 구분을 위한 source 컬럼 추가
ALTER TABLE trade_history 
ADD COLUMN IF NOT EXISTS source TEXT CHECK (source IN ('AMM', 'Orderbook')) DEFAULT 'Orderbook';

-- 2. AMM 관련 정보 컬럼 추가
ALTER TABLE trade_history 
ADD COLUMN IF NOT EXISTS price_impact DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS amm_reserves_before JSONB,
ADD COLUMN IF NOT EXISTS amm_reserves_after JSONB,
ADD COLUMN IF NOT EXISTS redis_trade_id TEXT;

-- 3. 새로운 source 인덱스 추가 (기존 인덱스들은 유지)
CREATE INDEX IF NOT EXISTS idx_trade_history_source ON trade_history(source);
CREATE INDEX IF NOT EXISTS idx_trade_history_redis_id ON trade_history(redis_trade_id);

-- 4. buyer_order_id, seller_order_id 타입 변경 (UUID → TEXT, Redis ID 저장용)
-- 기존 데이터가 있을 수 있으므로 조건부 실행
DO $$
BEGIN
    -- buyer_order_id 컬럼이 UUID 타입인지 확인
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'trade_history' 
        AND column_name = 'buyer_order_id' 
        AND data_type = 'uuid'
    ) THEN
        -- 외래키 제약조건 임시 제거
        ALTER TABLE trade_history DROP CONSTRAINT IF EXISTS trade_history_buyer_order_id_fkey;
        ALTER TABLE trade_history DROP CONSTRAINT IF EXISTS trade_history_seller_order_id_fkey;
        
        -- 컬럼 타입 변경
        ALTER TABLE trade_history ALTER COLUMN buyer_order_id TYPE TEXT;
        ALTER TABLE trade_history ALTER COLUMN seller_order_id TYPE TEXT;
    END IF;
END $$;

-- 5. AMM 거래를 위한 제약조건 수정
ALTER TABLE trade_history DROP CONSTRAINT IF EXISTS valid_source_orders;
ALTER TABLE trade_history ADD CONSTRAINT valid_source_orders CHECK (
    (source = 'AMM') OR 
    (source = 'Orderbook' AND buyer_order_id IS NOT NULL AND seller_order_id IS NOT NULL)
);

-- 6. 코멘트 업데이트
COMMENT ON COLUMN trade_history.source IS 'AMM: 자동마켓메이커 거래, Orderbook: 오더북 매칭 거래';
COMMENT ON COLUMN trade_history.price_impact IS 'AMM 거래시 가격 영향도 (백분율)';
COMMENT ON COLUMN trade_history.redis_trade_id IS 'Redis에 저장된 원본 거래 ID (중복 방지용)';
COMMENT ON COLUMN trade_history.buyer_order_id IS 'Redis order ID (Orderbook) 또는 amm (AMM)';
COMMENT ON COLUMN trade_history.seller_order_id IS 'Redis order ID (Orderbook) 또는 amm (AMM)';

-- Migration 완료
SELECT 'Trade history table extended for AMM support!' as status;