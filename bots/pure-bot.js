#!/usr/bin/env node
/*
  Pure rebalancing bot (B option from ggg.md)
  - Reads NAV via IHLCoreReader
  - Computes target notionals from strategy JSON
  - Applies risk guards (turnover cap, per-symbol cap, net delta guard, cooldown)
  - Calls IHLCoreWriter.reduceTo(symbol, target, slippageBps, ttl)

  Env vars (see .env.example):
  - RPC_URL, PRIVATE_KEY, READER_ADDR, WRITER_ADDR
  - INTERVAL_SECONDS (default 3600), SLIP_BPS (default 30), TTL_SECONDS (default 60)

  Usage:
    node pure-bot.js --strategy strategy_eth_vs_l2.json [--once] [--dry-run]
*/
require('dotenv').config();
const fs = require('fs');
const path = require('path');

let ethers;
try {
  ethers = require('ethers');
} catch (e) {
  console.error('Missing dependency: ethers. Install with `npm i ethers dotenv`');
  process.exit(1);
}

const argv = process.argv.slice(2);
function getArg(name, def) {
  const i = argv.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return def;
  const v = argv[i].includes('=') ? argv[i].split('=')[1] : argv[i+1];
  return v === undefined ? true : v;
}

const STRATEGY_PATH = getArg('strategy', 'strategy_eth_vs_l2.json');
const ONCE = argv.includes('--once') || getArg('once', false) === 'true';
const CLI_DRY = argv.includes('--dry-run') || getArg('dry-run', false) === 'true';

const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const READER_ADDR = process.env.READER_ADDR;
const WRITER_ADDR = process.env.WRITER_ADDR;

const INTERVAL_SECONDS = Number(process.env.INTERVAL_SECONDS || 3600);
const SLIP_BPS = Number(process.env.SLIP_BPS || 30);
const TTL_SECONDS = Number(process.env.TTL_SECONDS || 60);

const readerAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'IHLCoreReader.json'), 'utf8'));
const writerAbi = JSON.parse(fs.readFileSync(path.join(__dirname, 'IHLCoreWriter.json'), 'utf8'));

function loadJsonSafe(p) {
  const full = path.isAbsolute(p) ? p : path.join(__dirname, p);
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

const strat = loadJsonSafe(STRATEGY_PATH);

let cfg = {
  turnoverCapBps: 1000,            // Max sum(|delta|) per run as % of NAV
  maxNetDeltaUSD: 50_000,          // Allowed net after actions (absolute)
  perSymbolMaxUSD: { default: 250_000 },
  cooldownSeconds: 3600,
  maxRetries: 3,
  retryBackoffMs: 5000,
  dryRun: false
};
try {
  const maybe = loadJsonSafe('config.json');
  cfg = Object.assign(cfg, maybe);
} catch (_) {
  try {
    const ex = loadJsonSafe('config.example.json');
    cfg = Object.assign(cfg, ex);
  } catch (_) {}
}
if (CLI_DRY) cfg.dryRun = true;

if (!RPC_URL || !PRIVATE_KEY || !READER_ADDR || !WRITER_ADDR) {
  console.error('Missing env: RPC_URL, PRIVATE_KEY, READER_ADDR, WRITER_ADDR');
  process.exit(1);
}

let provider;
if (ethers.providers && ethers.providers.JsonRpcProvider) {
  provider = new ethers.providers.JsonRpcProvider(RPC_URL); // ethers v5
} else if (ethers.JsonRpcProvider) {
  provider = new ethers.JsonRpcProvider(RPC_URL); // ethers v6
} else {
  console.error('Unsupported ethers version: missing JsonRpcProvider');
  process.exit(1);
}
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const reader = new ethers.Contract(READER_ADDR, readerAbi, wallet);
const writer = new ethers.Contract(WRITER_ADDR, writerAbi, wallet);

let lastTs = 0;

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

function bpsToRatio(bps) { return Number(bps) / 10000; }

function toBigInt(x) {
  if (typeof x === 'bigint') return x;
  if (typeof x === 'number') return BigInt(Math.trunc(x));
  if (typeof x === 'string') return BigInt(x);
  if (x && (x._isBigNumber || x.type === 'BigNumber') && typeof x.toString === 'function') return BigInt(x.toString());
  throw new Error('Unsupported numeric type for BigInt conversion');
}

function toBigNumberish(x) {
  // Pass as string for widest ethers(v5/v6) compatibility
  return typeof x === 'bigint' ? x.toString() : x;
}

function clampTarget(sym, target) {
  const cap = BigInt(Math.floor((cfg.perSymbolMaxUSD[sym] ?? cfg.perSymbolMaxUSD.default) * 1e6));
  if (target > cap) return cap;
  if (target < -cap) return -cap;
  return target;
}

async function getPositions(symbols) {
  const ps = {};
  for (const s of symbols) {
    try {
      const v = await reader.positionUSD(s);
      ps[s] = toBigInt(v);
    } catch (e) {
      console.error(`positionUSD(${s}) error:`, e?.message || e);
      ps[s] = 0n;
    }
  }
  return ps;
}

function sumAbs(arr) { return arr.reduce((a,b)=>a + (b<0n? -b : b), 0n); }

async function rebalanceOnce() {
  const now = Math.floor(Date.now()/1000);
  if (now - lastTs < cfg.cooldownSeconds) {
    console.log('cooldown… skip');
    return;
  }

  const nav = toBigInt(await reader.equityUSD()); // 1e6 scale
  const longBucket = nav;   // +100%
  const shortBucket = nav;  // -100%

  const symbolsLong = strat.longs.map(l=>l.symbol);
  const symbolsShort = strat.shorts.map(s=>s.symbol);
  const allSymbols = Array.from(new Set([...symbolsLong, ...symbolsShort]));
  const current = await getPositions(allSymbols);

  // Compute raw targets
  const targets = {};
  for (const L of strat.longs) {
    const t = (longBucket * BigInt(L.bps)) / 10000n; // +
    targets[L.symbol] = (targets[L.symbol] || 0n) + t;
  }
  for (const S of strat.shorts) {
    const t = -((shortBucket * BigInt(S.bps)) / 10000n); // -
    targets[S.symbol] = (targets[S.symbol] || 0n) + t;
  }

  // Clamp per-symbol caps
  for (const sym of Object.keys(targets)) {
    targets[sym] = clampTarget(sym, targets[sym]);
  }

  // Turnover cap: scale adjustments if needed
  const deltas = {};
  for (const sym of Object.keys(targets)) {
    deltas[sym] = targets[sym] - (current[sym] || 0n);
  }
  const grossTurnover = sumAbs(Object.values(deltas)); // 1e6
  const maxTurnover = (nav * BigInt(cfg.turnoverCapBps)) / 10000n;
  let scaleNum = 1n, scaleDen = 1n;
  if (grossTurnover > maxTurnover && grossTurnover > 0n) {
    // scale deltas proportionally
    scaleNum = maxTurnover;
    scaleDen = grossTurnover;
  }

  // Net delta guard (intended)
  let intendedNet = 0n;
  for (const sym of Object.keys(targets)) intendedNet += targets[sym];
  const absIntended = intendedNet < 0n ? -intendedNet : intendedNet;
  if (absIntended > BigInt(Math.floor(cfg.maxNetDeltaUSD * 1e6))) {
    console.warn('intended net exceeds guard; proportionally shrinking long/short buckets');
    // shrink both buckets by the same ratio to get net near 0
    // here simply center targets by subtracting (intendedNet / N)
    const N = BigInt(Object.keys(targets).length || 1);
    const adj = intendedNet / N;
    for (const sym of Object.keys(targets)) targets[sym] -= adj;
  }

  // Prepare final orders with scaling
  const orders = [];
  for (const sym of Object.keys(deltas)) {
    const cur = current[sym] || 0n;
    const scaledDelta = (deltas[sym] * scaleNum) / scaleDen; // signed
    const finalTarget = cur + scaledDelta; // reduceTo expects absolute target
    orders.push({ symbol: sym, target: finalTarget });
  }

  // Log plan
  console.log('NAV(1e6):', nav.toString());
  console.table(
    orders.map(o => ({ symbol: o.symbol, current: (current[o.symbol]||0n).toString(), target: o.target.toString() }))
  );
  console.log('turnover(1e6):', grossTurnover.toString(), 'cap(1e6):', maxTurnover.toString());

  if (cfg.dryRun) {
    console.log('[dry-run] Skipping on-chain reduceTo calls');
    lastTs = now;
    return;
  }

  // Execute orders with retries
  for (const o of orders) {
    let attempt = 0;
    while (attempt < cfg.maxRetries) {
      try {
        const tx = await writer.reduceTo(o.symbol, toBigNumberish(o.target), SLIP_BPS, TTL_SECONDS);
        console.log('sent', o.symbol, tx.hash);
        const rc = await tx.wait();
        console.log('done', o.symbol, rc?.status);
        break;
      } catch (e) {
        attempt++;
        console.error(`reduceTo ${o.symbol} attempt ${attempt} error:`, e?.message || e);
        if (attempt >= cfg.maxRetries) throw e;
        await sleep(cfg.retryBackoffMs * attempt);
      }
    }
  }

  lastTs = now;
}

async function main() {
  console.log('Starting pure-bot with strategy:', strat.name || STRATEGY_PATH);
  await rebalanceOnce();
  if (ONCE) return;
  setInterval(() => {
    rebalanceOnce().catch(e => console.error('rebalance error:', e?.message || e));
  }, INTERVAL_SECONDS * 1000);
}

main().catch(e => {
  console.error('fatal:', e?.message || e);
  process.exit(1);
});
