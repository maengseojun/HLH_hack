-- ====================================
-- HyperIndex 오더북 시스템 - 최종 버전
-- 단순하고 안전한 생성
-- ====================================

-- 1. 주문 이력 테이블
CREATE TABLE IF NOT EXISTS order_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    pair TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit')),
    price DECIMAL(20,8),
    amount DECIMAL(20,8) NOT NULL,
    filled_amount DECIMAL(20,8) DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('active', 'filled', 'cancelled', 'partial')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    redis_order_id TEXT UNIQUE
);

-- 2. 체결 기록 테이블
CREATE TABLE IF NOT EXISTS trade_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pair TEXT NOT NULL,
    buyer_order_id UUID,
    seller_order_id UUID,
    price DECIMAL(20,8) NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    buyer_fee DECIMAL(20,8) DEFAULT 0,
    seller_fee DECIMAL(20,8) DEFAULT 0,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 사용자 잔고 테이블
CREATE TABLE IF NOT EXISTS user_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token_symbol TEXT NOT NULL,
    available_balance DECIMAL(20,8) DEFAULT 0,
    locked_balance DECIMAL(20,8) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, token_symbol)
);

-- ====================================
-- 외래키 제약조건 (테이블 생성 후)
-- ====================================

-- trade_history 외래키 (따로 추가)
DO $$ 
BEGIN
    -- buyer_order_id 외래키 추가 (존재하지 않는 경우에만)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'trade_history_buyer_order_id_fkey'
    ) THEN
        ALTER TABLE trade_history 
        ADD CONSTRAINT trade_history_buyer_order_id_fkey 
        FOREIGN KEY (buyer_order_id) REFERENCES order_history(id);
    END IF;
    
    -- seller_order_id 외래키 추가 (존재하지 않는 경우에만)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'trade_history_seller_order_id_fkey'
    ) THEN
        ALTER TABLE trade_history 
        ADD CONSTRAINT trade_history_seller_order_id_fkey 
        FOREIGN KEY (seller_order_id) REFERENCES order_history(id);
    END IF;
END $$;

-- ====================================
-- 인덱스 생성
-- ====================================

-- 활성 주문 조회용
CREATE INDEX IF NOT EXISTS idx_order_history_pair_status 
ON order_history(pair, status) WHERE status = 'active';

-- 사용자 활성 주문 조회용
CREATE INDEX IF NOT EXISTS idx_order_history_user_active 
ON order_history(user_id, status) WHERE status = 'active';

-- 거래 기록 조회용
CREATE INDEX IF NOT EXISTS idx_trade_history_pair_time 
ON trade_history(pair, executed_at DESC);

-- 사용자 잔고 조회용
CREATE INDEX IF NOT EXISTS idx_user_balances_user 
ON user_balances(user_id);

-- Redis 매핑용 인덱스
CREATE INDEX IF NOT EXISTS idx_order_history_redis_id 
ON order_history(redis_order_id);

-- ====================================
-- 트리거 함수
-- ====================================

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성 (존재하지 않는 경우에만)
DO $$
BEGIN
    -- order_history 트리거
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_order_history_modtime'
    ) THEN
        CREATE TRIGGER update_order_history_modtime 
            BEFORE UPDATE ON order_history 
            FOR EACH ROW EXECUTE FUNCTION update_modified_column();
    END IF;
    
    -- user_balances 트리거
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_user_balances_modtime'
    ) THEN
        CREATE TRIGGER update_user_balances_modtime 
            BEFORE UPDATE ON user_balances 
            FOR EACH ROW EXECUTE FUNCTION update_modified_column();
    END IF;
END $$;

-- ====================================
-- Row Level Security
-- ====================================

-- RLS 활성화
ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;

-- 정책 생성 (존재하지 않는 경우에만)
DO $$
BEGIN
    -- order_history 정책들
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'order_history' AND policyname = 'Users can view their own orders'
    ) THEN
        CREATE POLICY "Users can view their own orders" ON order_history
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'order_history' AND policyname = 'Users can create their own orders'
    ) THEN
        CREATE POLICY "Users can create their own orders" ON order_history
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    
    -- trade_history 정책
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'trade_history' AND policyname = 'Anyone can view trades'
    ) THEN
        CREATE POLICY "Anyone can view trades" ON trade_history
            FOR SELECT USING (true);
    END IF;
    
    -- user_balances 정책들
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'user_balances' AND policyname = 'Users can view their own balances'
    ) THEN
        CREATE POLICY "Users can view their own balances" ON user_balances
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'user_balances' AND policyname = 'Users can update their own balances'
    ) THEN
        CREATE POLICY "Users can update their own balances" ON user_balances
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ====================================
-- 코멘트
-- ====================================

COMMENT ON TABLE order_history IS '주문 영구 저장소 - Redis 오더북과 redis_order_id로 매핑';
COMMENT ON TABLE trade_history IS '체결 기록 영구 저장 - 분석 및 히스토리 조회용';
COMMENT ON TABLE user_balances IS '사용자 잔고 관리 - 주문 실행 시 잔고 검증용';

-- Migration 완료
SELECT 'Orderbook tables created successfully!' as status;