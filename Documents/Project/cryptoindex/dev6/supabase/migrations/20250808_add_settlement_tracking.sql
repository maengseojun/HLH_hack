-- ====================================
-- On-chain Settlement 추적을 위한 컬럼 추가
-- trade_history 테이블에 settlement 정보 추가
-- ====================================

-- 1. Settlement 관련 컬럼 추가
ALTER TABLE trade_history 
ADD COLUMN IF NOT EXISTS settlement_tx_hash TEXT,
ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS settlement_status TEXT CHECK (settlement_status IN ('pending', 'submitted', 'confirmed', 'failed'));

-- 2. 기본값 설정 - Orderbook 거래는 pending, AMM은 자동 confirmed
UPDATE trade_history 
SET settlement_status = CASE 
    WHEN source = 'AMM' THEN 'confirmed'
    WHEN source = 'Orderbook' AND settlement_tx_hash IS NOT NULL THEN 'confirmed'
    WHEN source = 'Orderbook' THEN 'pending'
    ELSE 'pending'
END
WHERE settlement_status IS NULL;

-- 3. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_trade_history_settlement_status ON trade_history(settlement_status);
CREATE INDEX IF NOT EXISTS idx_trade_history_settlement_tx ON trade_history(settlement_tx_hash);
CREATE INDEX IF NOT EXISTS idx_trade_history_settled_at ON trade_history(settled_at);

-- 4. Settlement 대기 중인 거래를 빠르게 찾기 위한 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_pending_settlements ON trade_history(source, settlement_status) 
WHERE source = 'Orderbook' AND settlement_status = 'pending';

-- 5. User nonces 테이블 (Settlement 컨트랙트와 동기화)
CREATE TABLE IF NOT EXISTS user_settlement_nonces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    wallet_address TEXT NOT NULL,
    nonce INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address)
);

-- 6. Settlement 실패 로그 테이블
CREATE TABLE IF NOT EXISTS settlement_failures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_id UUID REFERENCES trade_history(id),
    redis_trade_id TEXT,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    failed_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 7. 코멘트 추가
COMMENT ON COLUMN trade_history.settlement_tx_hash IS '온체인 settlement 트랜잭션 해시';
COMMENT ON COLUMN trade_history.settled_at IS '온체인 settlement 완료 시각';
COMMENT ON COLUMN trade_history.settlement_status IS 'pending: 대기중, submitted: 트랜잭션 제출됨, confirmed: 확인됨, failed: 실패';
COMMENT ON TABLE user_settlement_nonces IS '사용자별 settlement nonce 추적 (재실행 방지)';
COMMENT ON TABLE settlement_failures IS 'Settlement 실패 기록 및 재시도 추적';

-- 8. RLS 정책 추가
ALTER TABLE user_settlement_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_failures ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 nonce만 볼 수 있음
CREATE POLICY "Users can view own nonces" ON user_settlement_nonces
    FOR SELECT USING (user_id = auth.uid());

-- Settlement 실패는 관리자만 볼 수 있음
CREATE POLICY "Only admins can view settlement failures" ON settlement_failures
    FOR ALL USING (false); -- 실제로는 admin role 체크

-- Migration 완료
SELECT 'Added settlement tracking columns and tables!' as status;