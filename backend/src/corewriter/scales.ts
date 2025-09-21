export function humanPxToRaw(humanPx: number, priceDecimals: number): bigint {
  const scale = 10 ** priceDecimals;
  return BigInt(Math.round(humanPx * scale));
}

export function rawPxToHuman(rawPx: bigint, priceDecimals: number): number {
  const scale = 10 ** priceDecimals;
  return Number(rawPx) / scale;
}

export function humanSzToRaw(humanSz: number, szDecimals: number): bigint {
  const scale = 10 ** szDecimals;
  return BigInt(Math.round(humanSz * scale));
}

export function rawSzToHuman(rawSz: bigint, szDecimals: number): number {
  const scale = 10 ** szDecimals;
  return Number(rawSz) / scale;
}

export function roundQtyToStep(qtyHuman: number, szDecimals: number): number {
  if (szDecimals <= 0) {
    return Math.floor(qtyHuman);
  }
  const step = 10 ** (-szDecimals);
  return Math.floor(qtyHuman / step) * step;
}
