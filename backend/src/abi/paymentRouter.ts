export const PAYMENT_ROUTER_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address', name: 'merchant', type: 'address' },
      { internalType: 'bytes32', name: 'intentId', type: 'bytes32' }
    ],
    name: 'settle',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'intentId', type: 'bytes32' },
      { indexed: true, internalType: 'address', name: 'payer', type: 'address' },
      { indexed: true, internalType: 'address', name: 'merchant', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'IntentSettled',
    type: 'event'
  }
] as const;
