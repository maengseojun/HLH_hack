-- ====================================
-- HyperIndex 오더북 시스템 - 원본 설계 기준
-- 기준: OrderbookArchitecture_Design_0801.md
-- 철학: PostgreSQL = Cold Storage, Redis = Hot Data
-- ====================================

-- 1. 주문 이력 테이블 (원본 설계 그대로)
CREATE TABLE IF NOT EXISTS order_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    pair TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('buy', 'sell')),
    order_type TEXT NOT NULL CHECK (order_type IN ('market', 'limit')),
    price DECIMAL(20,8),
    amount DECIMAL(20,8) NOT NULL,
    filled_amount DECIMAL(20,8) DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('active', 'filled', 'cancelled', 'partial')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    redis_order_id TEXT UNIQUE -- Redis의 orderId와 매핑 (핵심!)
);

-- 2. 체결 기록 테이블 (원본 설계 그대로)
CREATE TABLE IF NOT EXISTS trade_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pair TEXT NOT NULL,
    buyer_order_id UUID REFERENCES order_history(id),
    seller_order_id UUID REFERENCES order_history(id),
    price DECIMAL(20,8) NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    buyer_fee DECIMAL(20,8) DEFAULT 0,
    seller_fee DECIMAL(20,8) DEFAULT 0,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 사용자 잔고 테이블 (원본 설계 그대로)
CREATE TABLE IF NOT EXISTS user_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    available_balance DECIMAL(20,8) DEFAULT 0,
    locked_balance DECIMAL(20,8) DEFAULT 0, -- 주문 중인 잔고
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, token_symbol)
);

-- ====================================
-- 성능 최적화 인덱스 (원본 설계 기준)
-- ====================================

-- 활성 주문 조회용 (부분 인덱스)
CREATE INDEX IF NOT EXISTS idx_order_history_pair_status 
ON order_history(pair, status) WHERE status = 'active';

-- 사용자 활성 주문 조회용
CREATE INDEX IF NOT EXISTS idx_order_history_user_active 
ON order_history(user_id, status) WHERE status = 'active';

-- 거래 기록 조회용 (시간순)
CREATE INDEX IF NOT EXISTS idx_trade_history_pair_time 
ON trade_history(pair, executed_at DESC);

-- 사용자 잔고 조회용
CREATE INDEX IF NOT EXISTS idx_user_balances_user 
ON user_balances(user_id);

-- Redis 매핑용 인덱스 (중요!)
CREATE INDEX IF NOT EXISTS idx_order_history_redis_id 
ON order_history(redis_order_id);

-- ====================================
-- 트리거 함수 (최소한만)
-- ====================================

-- 업데이트 시간 자동 갱신
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 주문 테이블 업데이트 트리거
CREATE TRIGGER update_order_history_modtime 
    BEFORE UPDATE ON order_history 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- 잔고 테이블 업데이트 트리거
CREATE TRIGGER update_user_balances_modtime 
    BEFORE UPDATE ON user_balances 
    FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- ====================================
-- Row Level Security (기본만)
-- ====================================

-- RLS 활성화
ALTER TABLE order_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;

-- 기본 정책들
CREATE POLICY "Users can view their own orders" ON order_history
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can create their own orders" ON order_history
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Anyone can view trades" ON trade_history
    FOR SELECT USING (true);

CREATE POLICY "Users can view their own balances" ON user_balances
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own balances" ON user_balances
    FOR UPDATE USING (auth.uid()::text = user_id);

-- ====================================
-- 코멘트 (설계 의도 명시)
-- ====================================

COMMENT ON TABLE order_history IS '주문 영구 저장소 - Redis 오더북과 redis_order_id로 매핑';
COMMENT ON TABLE trade_history IS '체결 기록 영구 저장 - 분석 및 히스토리 조회용';
COMMENT ON TABLE user_balances IS '사용자 잔고 관리 - 주문 실행 시 잔고 검증용';

COMMENT ON COLUMN order_history.redis_order_id IS 'Redis 오더북의 orderId와 1:1 매핑';
COMMENT ON COLUMN user_balances.locked_balance IS '주문 중인 금액 - 주문 생성 시 잠김';

-- Migration 완료
SELECT 'Simplified orderbook tables created successfully!' as status;