-- ====================================
-- HyperIndex Orderbook Tables Migration
-- Created: 2025-08-01
-- Purpose: Redis 오더북 시스템과 동기화할 PostgreSQL 테이블들
-- ====================================

-- 1. 오더북 주문 테이블
CREATE TABLE IF NOT EXISTS orderbook_orders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pair VARCHAR(20) NOT NULL, -- e.g., "HYPERINDEX-USDC"
    side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')),
    order_type VARCHAR(10) NOT NULL CHECK (order_type IN ('market', 'limit')),
    price DECIMAL(20, 8) NOT NULL DEFAULT 0,
    amount DECIMAL(20, 8) NOT NULL,
    filled DECIMAL(20, 8) NOT NULL DEFAULT 0,
    remaining DECIMAL(20, 8) NOT NULL,
    status VARCHAR(10) NOT NULL CHECK (status IN ('pending', 'active', 'filled', 'cancelled', 'expired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NULL,
    
    -- 인덱스들
    INDEX idx_orderbook_orders_user_id (user_id),
    INDEX idx_orderbook_orders_pair (pair),
    INDEX idx_orderbook_orders_status (status),
    INDEX idx_orderbook_orders_side_pair (side, pair),
    INDEX idx_orderbook_orders_created_at (created_at DESC),
    INDEX idx_orderbook_orders_price_side (price, side) WHERE status = 'active'
);

-- 2. 오더북 거래 테이블
CREATE TABLE IF NOT EXISTS orderbook_trades (
    id UUID PRIMARY KEY,
    pair VARCHAR(20) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    amount DECIMAL(20, 8) NOT NULL,
    side VARCHAR(4) NOT NULL CHECK (side IN ('buy', 'sell')), -- taker side
    buy_order_id UUID NOT NULL,
    sell_order_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 외래키 제약조건
    FOREIGN KEY (buy_order_id) REFERENCES orderbook_orders(id),
    FOREIGN KEY (sell_order_id) REFERENCES orderbook_orders(id),
    
    -- 인덱스들
    INDEX idx_orderbook_trades_pair (pair),
    INDEX idx_orderbook_trades_created_at (created_at DESC),
    INDEX idx_orderbook_trades_buy_order (buy_order_id),
    INDEX idx_orderbook_trades_sell_order (sell_order_id)
);

-- 3. 사용자 거래 통계 테이블
CREATE TABLE IF NOT EXISTS user_trading_stats (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    total_volume DECIMAL(30, 8) NOT NULL DEFAULT 0,
    total_trades INTEGER NOT NULL DEFAULT 0,
    total_fees_paid DECIMAL(20, 8) NOT NULL DEFAULT 0,
    first_trade_at TIMESTAMPTZ NULL,
    last_trade_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 일별 거래 통계 테이블
CREATE TABLE IF NOT EXISTS daily_trading_stats (
    pair VARCHAR(20) NOT NULL,
    trading_date DATE NOT NULL,
    open_price DECIMAL(20, 8) NULL,
    close_price DECIMAL(20, 8) NULL,
    high_price DECIMAL(20, 8) NULL,
    low_price DECIMAL(20, 8) NULL,
    volume DECIMAL(30, 8) NOT NULL DEFAULT 0,
    trades_count INTEGER NOT NULL DEFAULT 0,
    unique_traders INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (pair, trading_date),
    INDEX idx_daily_stats_date (trading_date DESC),
    INDEX idx_daily_stats_pair (pair)
);

-- 5. 오더북 스냅샷 테이블 (성능 분석용)
CREATE TABLE IF NOT EXISTS orderbook_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pair VARCHAR(20) NOT NULL,
    snapshot_data JSONB NOT NULL, -- 오더북 전체 데이터
    best_bid DECIMAL(20, 8) NULL,
    best_ask DECIMAL(20, 8) NULL,
    spread DECIMAL(20, 8) NULL,
    total_bid_volume DECIMAL(30, 8) NULL,
    total_ask_volume DECIMAL(30, 8) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    INDEX idx_orderbook_snapshots_pair (pair),
    INDEX idx_orderbook_snapshots_created_at (created_at DESC)
);

-- ====================================
-- 트리거 함수들
-- ====================================

-- 1. updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. 사용자 통계 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_user_trading_stats()
RETURNS TRIGGER AS $$
DECLARE
    buyer_id UUID;
    seller_id UUID;
    trade_volume DECIMAL(30, 8);
BEGIN
    -- 거래량 계산
    trade_volume := NEW.price * NEW.amount;
    
    -- 구매자와 판매자 ID 가져오기
    SELECT user_id INTO buyer_id FROM orderbook_orders WHERE id = NEW.buy_order_id;
    SELECT user_id INTO seller_id FROM orderbook_orders WHERE id = NEW.sell_order_id;
    
    -- 구매자 통계 업데이트
    INSERT INTO user_trading_stats (user_id, total_volume, total_trades, first_trade_at, last_trade_at, updated_at)
    VALUES (buyer_id, trade_volume, 1, NEW.created_at, NEW.created_at, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        total_volume = user_trading_stats.total_volume + trade_volume,
        total_trades = user_trading_stats.total_trades + 1,
        first_trade_at = COALESCE(user_trading_stats.first_trade_at, NEW.created_at),
        last_trade_at = GREATEST(user_trading_stats.last_trade_at, NEW.created_at),
        updated_at = NOW();
    
    -- 판매자 통계 업데이트 (구매자와 다른 경우에만)
    IF buyer_id != seller_id THEN
        INSERT INTO user_trading_stats (user_id, total_volume, total_trades, first_trade_at, last_trade_at, updated_at)
        VALUES (seller_id, trade_volume, 1, NEW.created_at, NEW.created_at, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
            total_volume = user_trading_stats.total_volume + trade_volume,
            total_trades = user_trading_stats.total_trades + 1,
            first_trade_at = COALESCE(user_trading_stats.first_trade_at, NEW.created_at),
            last_trade_at = GREATEST(user_trading_stats.last_trade_at, NEW.created_at),
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 3. 일별 통계 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_daily_trading_stats()
RETURNS TRIGGER AS $$
DECLARE
    trade_date DATE;
    trade_volume DECIMAL(30, 8);
BEGIN
    trade_date := DATE(NEW.created_at);
    trade_volume := NEW.price * NEW.amount;
    
    INSERT INTO daily_trading_stats (
        pair, trading_date, open_price, close_price, 
        high_price, low_price, volume, trades_count, updated_at
    )
    VALUES (
        NEW.pair, trade_date, NEW.price, NEW.price,
        NEW.price, NEW.price, trade_volume, 1, NOW()
    )
    ON CONFLICT (pair, trading_date)
    DO UPDATE SET
        close_price = NEW.price,
        high_price = GREATEST(daily_trading_stats.high_price, NEW.price),
        low_price = LEAST(daily_trading_stats.low_price, NEW.price),
        volume = daily_trading_stats.volume + trade_volume,
        trades_count = daily_trading_stats.trades_count + 1,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ====================================
-- 트리거 생성
-- ====================================

-- updated_at 트리거들
CREATE TRIGGER trigger_orderbook_orders_updated_at
    BEFORE UPDATE ON orderbook_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_user_trading_stats_updated_at
    BEFORE UPDATE ON user_trading_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_daily_trading_stats_updated_at
    BEFORE UPDATE ON daily_trading_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 통계 업데이트 트리거들
CREATE TRIGGER trigger_update_user_stats_on_trade
    AFTER INSERT ON orderbook_trades
    FOR EACH ROW
    EXECUTE FUNCTION update_user_trading_stats();

CREATE TRIGGER trigger_update_daily_stats_on_trade
    AFTER INSERT ON orderbook_trades
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_trading_stats();

-- ====================================
-- Row Level Security (RLS) 정책
-- ====================================

-- RLS 활성화
ALTER TABLE orderbook_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orderbook_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_trading_stats ENABLE ROW LEVEL SECURITY;

-- 주문 테이블 정책
CREATE POLICY "Users can view their own orders" ON orderbook_orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders" ON orderbook_orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders" ON orderbook_orders
    FOR UPDATE USING (auth.uid() = user_id);

-- 거래 테이블 정책 (모든 사용자가 읽기 가능)
CREATE POLICY "Anyone can view trades" ON orderbook_trades
    FOR SELECT USING (true);

-- 사용자 통계 정책
CREATE POLICY "Users can view their own stats" ON user_trading_stats
    FOR SELECT USING (auth.uid() = user_id);

-- 일별 통계는 모든 사용자가 읽기 가능
CREATE POLICY "Anyone can view daily stats" ON daily_trading_stats
    FOR SELECT USING (true);

-- 오더북 스냅샷은 모든 사용자가 읽기 가능
CREATE POLICY "Anyone can view orderbook snapshots" ON orderbook_snapshots
    FOR SELECT USING (true);

-- ====================================
-- 초기 데이터 및 설정
-- ====================================

-- 시스템 사용자 생성 (매칭 엔진용)
INSERT INTO auth.users (id, email, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'system@hyperindex.io',
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 주요 거래쌍 초기화
INSERT INTO daily_trading_stats (pair, trading_date)
VALUES 
    ('HYPERINDEX-USDC', CURRENT_DATE),
    ('DOGE-USDC', CURRENT_DATE),
    ('PEPE-USDC', CURRENT_DATE),
    ('SHIB-USDC', CURRENT_DATE)
ON CONFLICT (pair, trading_date) DO NOTHING;

-- ====================================
-- 유용한 뷰들
-- ====================================

-- 1. 활성 주문 뷰
CREATE VIEW active_orders AS
SELECT 
    o.*,
    u.email as user_email
FROM orderbook_orders o
JOIN auth.users u ON o.user_id = u.id
WHERE o.status = 'active'
ORDER BY o.created_at DESC;

-- 2. 최근 거래 뷰
CREATE VIEW recent_trades AS
SELECT 
    t.*,
    bo.user_id as buyer_id,
    so.user_id as seller_id,
    bu.email as buyer_email,
    su.email as seller_email
FROM orderbook_trades t
JOIN orderbook_orders bo ON t.buy_order_id = bo.id
JOIN orderbook_orders so ON t.sell_order_id = so.id
JOIN auth.users bu ON bo.user_id = bu.id
JOIN auth.users su ON so.user_id = su.id
ORDER BY t.created_at DESC;

-- 3. 오더북 요약 뷰
CREATE VIEW orderbook_summary AS
SELECT 
    pair,
    side,
    COUNT(*) as order_count,
    SUM(remaining) as total_volume,
    MIN(price) as min_price,
    MAX(price) as max_price,
    AVG(price) as avg_price
FROM orderbook_orders
WHERE status = 'active'
GROUP BY pair, side;

-- ====================================
-- 성능 최적화를 위한 추가 인덱스
-- ====================================

-- 복합 인덱스들
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_pair_side_price_active 
ON orderbook_orders (pair, side, price) 
WHERE status = 'active';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_status_created 
ON orderbook_orders (user_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_pair_created_at 
ON orderbook_trades (pair, created_at DESC);

-- 부분 인덱스들 (더 효율적)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_active_buy 
ON orderbook_orders (pair, price DESC, created_at) 
WHERE status = 'active' AND side = 'buy';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_active_sell 
ON orderbook_orders (pair, price ASC, created_at) 
WHERE status = 'active' AND side = 'sell';

-- ====================================
-- 코멘트 추가
-- ====================================

COMMENT ON TABLE orderbook_orders IS '오더북 주문 테이블 - Redis와 동기화';
COMMENT ON TABLE orderbook_trades IS '체결된 거래 기록 테이블';
COMMENT ON TABLE user_trading_stats IS '사용자별 거래 통계';
COMMENT ON TABLE daily_trading_stats IS '일별 시장 통계';
COMMENT ON TABLE orderbook_snapshots IS '오더북 스냅샷 (분석용)';

-- Migration 완료
SELECT 'Orderbook tables migration completed successfully!' as status;