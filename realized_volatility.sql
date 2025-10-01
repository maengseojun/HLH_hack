WITH
params AS (
    SELECT
        date_trunc('hour', now() - interval '{{LOOKBACK_DAYS}}' day) AS start_time,
        date_trunc('hour', now()) AS end_time
),

universe AS (
    SELECT * FROM (VALUES
        -- Paste your (chain, contract) list here
        ('ethereum', '0xae7ab96520de3a18e5e111b5eaab095312d7fe84'),
        ('bsc', '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c'),
        ('solana', 'So11111111111111111111111111111111111111112')
    ) AS t (chain, contract)
),

grid AS (
    SELECT
        u.chain,
        u.contract,
        h.hour
    FROM universe u
    CROSS JOIN unnest(sequence(
        (SELECT start_time FROM params),
        (SELECT end_time FROM params) - interval '1' hour,
        interval '1' hour
    )) AS h(hour)
),

px AS (
    SELECT
        p.hour,
        u.chain,
        u.contract,
        p.price
    FROM prices.hour p
    JOIN universe u ON
        CASE
            WHEN u.chain IN ('ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'base') THEN LOWER(p.contract_address) = LOWER(u.contract) AND p.blockchain = u.chain
            WHEN u.chain = 'solana' THEN p.contract_address = u.contract AND p.blockchain = u.chain
            ELSE FALSE
        END
    WHERE p.hour >= (SELECT start_time FROM params)
      AND p.hour < (SELECT end_time FROM params)
),

rets AS (
    SELECT
        g.chain,
        g.contract,
        g.hour,
        LN(p.price / LAG(p.price, 1) OVER (PARTITION BY g.chain, g.contract ORDER BY g.hour)) AS log_return
    FROM grid g
    LEFT JOIN px p ON g.chain = p.chain AND g.contract = p.contract AND g.hour = p.hour
    WHERE p.price IS NOT NULL AND p.price > 0 AND LAG(p.price, 1) OVER (PARTITION BY g.chain, g.contract ORDER BY g.hour) > 0
),

rv AS (
    SELECT
        chain,
        contract,
        SUM(log_return * log_return) AS sum_sq_lr,
        COUNT(log_return) AS n_lr
    FROM rets
    GROUP BY 1, 2
)

SELECT
    chain,
    contract,
    SQRT(sum_sq_lr) AS rv_7d_1h,
    n_lr,
    n_lr / (24.0 * {{LOOKBACK_DAYS}}) AS ebr_7d_1h
FROM rv
WHERE n_lr >= {{MIN_BARS}}
ORDER BY rv_7d_1h ASC
