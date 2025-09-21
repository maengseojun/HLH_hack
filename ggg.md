Henry Choi | HyperIndex, [2025-09-21 오후 8:53]
좋아—“토큰 구성/런쳐는 이미 있다”는 전제로, 그 계정에 주기적으로 리밸런싱 주문만 넣어주는 구현을 최소 세팅으로 두 가지 방식으로 줬어.

* A안: 온체인 컨트롤러(얇게) + 오프체인 봇이 `rebalance()`만 호출
* B안: 온체인 없이 봇이 바로 CoreWriter**에 `reduceTo` 주문 (가벼운 운용)

---

# A안) 얇은 온체인 컨트롤러 + Keeper 봇

## 1) Solidity (컨트롤러: 목표비중 저장 + reduceTo 호출)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/ Hyperliquid precompiles/adapters 가정 인터페이스 */
interface IHLCoreReader {
    function equityUSD() external view returns (uint256);                  // 1e6
    function positionUSD(string calldata symbol) external view returns (int256); // +롱/-숏, 1e6
}
interface IHLCoreWriter {
    function reduceTo(
        string calldata symbol,
        int256 targetNotionalSignedUSD,  // +롱/-숏 (1e6)
        uint256 slippageBps,
        uint64  ttlSeconds
    ) external;
}

contract HLRebalancer {
    address public gov;
    address public keeper;

    IHLCoreReader public reader;
    IHLCoreWriter public writer;

    uint256 public interval = 3600;       // 1h
    uint256 public lastRebalance;
    uint256 public maxSlippageBps = 30;   // per order
    int256  public maxNetDeltaUSD = 50_000e6; // guard

    struct Leg { string symbol; uint16 bps; } // 1%=100bp
    Leg[] public longs;   // 합계 10_000 (=100%)
    Leg[] public shorts;  // 합계 10_000 (=100%)

    modifier onlyGov(){require(msg.sender==gov,"gov"); _;}
    modifier onlyKeeper(){require(msg.sender==keeper||msg.sender==gov,"keeper"); _;}

    constructor(IHLCoreReader _r, IHLCoreWriter _w, address _keeper){
        gov = msg.sender;
        reader = _r; writer = _w; keeper = _keeper;
        lastRebalance = block.timestamp;
    }

    function setKeeper(address k) external onlyGov { keeper = k; }
    function setParams(uint256 _interval, uint256 _slip, int256 _net) external onlyGov {
        interval=_interval; maxSlippageBps=_slip; maxNetDeltaUSD=_net;
    }

    function setWeights(Leg[] calldata _longs, Leg[] calldata _shorts) external onlyGov {
        delete longs; delete shorts;
        uint sumL; uint sumS;
        for (uint i; i<_longs.length; i++){ longs.push(_longs[i]); sumL+=_longs[i].bps; }
        for (uint j; j<_shorts.length; j++){ shorts.push(_shorts[j]); sumS+=_shorts[j].bps; }
        require(sumL==10_000 && sumS==10_000, "weights must sum 100% each");
    }

    function rebalance() external onlyKeeper {
        require(block.timestamp >= lastRebalance + interval, "cooldown");
        uint256 nav = reader.equityUSD();     // 전략 계정 총 에쿼티(1e6)
        uint256 longBucket = nav;             // +100%
        uint256 shortBucket = nav;            // -100%

        // 롱 타깃
        for (uint i; i<longs.length; i++) {
            Leg memory L = longs[i];
            int256 target = int256(longBucket * L.bps / 10_000);
            writer.reduceTo(L.symbol, target, maxSlippageBps, 60);
        }
        // 숏 타깃
        for (uint j; j<shorts.length; j++) {
            Leg memory S = shorts[j];
            int256 target = -int256(shortBucket * S.bps / 10_000);
            writer.reduceTo(S.symbol, target, maxSlippageBps, 60);
        }

        // 간단 넷델타 가드
        int256 net;
        for (uint i; i<longs.length; i++)  net += reader.positionUSD(longs[i].symbol);
        for (uint j; j<shorts.length; j++) net += reader.positionUSD(shorts[j].symbol);
        require(net <= maxNetDeltaUSD && net >= -maxNetDeltaUSD, "net-delta");

        lastRebalance = block.timestamp;
        emit Rebalanced(lastRebalance, net);
    }
    event Rebalanced(uint256 ts, int256 netDeltaUSD);
}
```

Henry Choi | HyperIndex, [2025-09-21 오후 8:53]
* `setWeights()`에 롱/숏이 각 100% 합(bps 합 10\_000)으로 들어오게 강제 → Gross 200%
* `rebalance()`는 현재 포지션 → 목표 포지션**으로 `reduceTo()`만 호출
* NAV, 포지션, 주문은 전부 Hyperliquid precompiles/adapter를 통해 읽고/집행

## 2) Keeper(오프체인, 1시간 간격 호출) — Node.js/ethers

```ts
// keeper.ts
import 'dotenv/config';
import { ethers } from 'ethers';
import abi from './HLRebalancer.abi.json' assert { type: 'json' };

const RPC = process.env.RPC_URL!;
const PK  = process.env.PRIVATE_KEY!;
const ADDR= process.env.REBALANCER_ADDR!;

const provider = new ethers.JsonRpcProvider(RPC);
const wallet   = new ethers.Wallet(PK, provider);
const rebal    = new ethers.Contract(ADDR, abi, wallet);

async function tryRebalance() {
  try {
    const last = Number(await rebal.lastRebalance());
    const now  = Math.floor(Date.now()/1000);
    const interval = Number(await rebal.interval());
    if (now - last < interval) {
      console.log('cooldown… skip');
      return;
    }
    const tx = await rebal.rebalance({ gasLimit: 3_000_000 });
    console.log('sent:', tx.hash);
    const rc = await tx.wait();
    console.log('done, status:', rc?.status);
  } catch (e:any) {
    console.error('rebalance error:', e?.message || e);
  }
}

// 매시간 실행 (실전: pm2/cron/Gelato/Chainlink Automation 권장)
setInterval(tryRebalance, 60*60*1000);
tryRebalance();
```

`.env` 예시

```
RPC_URL=https://your-hyperevm-rpc
PRIVATE_KEY=0xabc...
REBALANCER_ADDR=0xYourDeployedContract
```

> 전략 교체는 온체인에서 한 번만 `setWeights()`로 업데이트하면, 봇은 **계속 rebalance만 누릅니다.

---

# B안) 온체인 없이 “순수 봇 → CoreWriter” (더 가벼움)

아이디어: 비중/전략은 로컬 JSON으로 들고 있고, 봇이 1시간마다

* 계정 `equityUSD()` 읽기 → 심볼별 target notional 계산
* 각 심볼에 `reduceTo(symbol, target, slip, ttl)` 직접 호출

// pure-bot.ts : 컨트랙트 없이 CoreWriter만 호출
import 'dotenv/config';
import { ethers } from 'ethers';
import readerAbi from './IHLCoreReader.json' assert { type: 'json' };
import writerAbi from './IHLCoreWriter.json' assert { type: 'json' };
import strat from './strategy_eth_vs_l2.json' assert { type: 'json' }; 
// { longs:[{symbol:"ETH",bps:5000},...], shorts:[{symbol:"ARB",bps:2500},...] }

const { RPC_URL, PRIVATE_KEY, READER_ADDR, WRITER_ADDR } = process.env;
const provider = new ethers.JsonRpcProvider(RPC_URL!);
const wallet   = new ethers.Wallet(PRIVATE_KEY!, provider);
const reader   = new ethers.Contract(READER_ADDR!, readerAbi, wallet);
const writer   = new ethers.Contract(WRITER_ADDR!, writerAbi, wallet);

const SLIP_BPS = 30, TTL = 60;

async function rebalance() {
  const nav = await reader.equityUSD();         // 1e6
  const longBucket = nav; const shortBucket = nav;

  // 롱 타깃
  for (const L of strat.longs) {
    const target = BigInt(longBucket) * BigInt(L.bps) / 10000n; // +값
    const tx = await writer.reduceTo(L.symbol, target, SLIP_BPS, TTL);
    await tx.wait();
  }
  // 숏 타깃
  for (const S of strat.shorts) {
    const target = -(BigInt(shortBucket) * BigInt(S.bps) / 10000n); // -값
    const tx = await writer.reduceTo(S.symbol, target, SLIP_BPS, TTL);
    await tx.wait();
  }
  console.log('rebalanced with strategy:', strat.name);
}

setInterval(rebalance, 60*60*1000);
rebalance();

`strategy_eth_vs_l2.json` 예시

{
  "name": "ETH Core vs L2",
  "longs": [
    {"symbol":"ETH","bps":5000},
    {"symbol":"BNB","bps":3000},
    {"symbol":"AVAX","bps":2000}
  ],
  "shorts": [
    {"symbol":"ARB","bps":2500},
    {"symbol":"OP","bps":2500},
    {"symbol":"POL","bps":2000},
    {"symbol":"IMX","bps":1500},
    {"symbol":"MNT","bps":1500}
  ]
}

> 장점: 배포 없이 바로 운용 시작.
> 단점: 온체인 가드(넷델타/쿨다운/슬리피지 상한) 로직이 없으니 봇에서 체크를 넣어야 함.

---

## 추천 체크리스트 (두 방식 공통)

* 리스크 가드:

  * 한 틱에서 바꾸는 총 Turnover 상한(NAV의 10% 등)
  * 심볼별 Max Notional 상한
  * 넷델타 허용 범위(±\$50k 등) 오프체인에서도 계산해 차단
* 오더 전략:

  * 유동성 낮은 시간대엔 분할 reduceTo(N회로 나눠 호출)
  * 실패/슬리피지 초과 시 재시도(backoff)
* 스케줄러:

  * pm2/cron or Gelato/Chainlink Automation (1h cadence)
* 로그/모니터링:

  * 체결 해시, 체결 비율, 실패 사유 로그 → 텔레그램/슬랙 알림

---

원하면 바로 \*\*네가 고른 3전략(ETHvsL2 / SOLvsEVM / BTCvsMEME)\*\*용 JSON 세트와, B안 봇 스크립트로 3개 각각 실행하는 패키지 형태까지 정리해줄게.