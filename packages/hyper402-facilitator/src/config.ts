/**
 * HyperEVM Testnet Configuration
 */

export const HYPEREVM_TESTNET_CONFIG = {
  chainId: 998,
  name: "HyperEVM Testnet",
  rpcUrl: process.env.HYPEREVM_RPC_URL || "https://rpc.hyperliquid-testnet.xyz/evm",
  nativeCurrency: {
    name: "HYPE",
    symbol: "HYPE",
    decimals: 18,
  },
  blockExplorer: "https://testnet.purrsec.com",
};

export const USDC_CONFIG = {
  address: (process.env.USDC_CONTRACT_ADDRESS || "0x2B3370eE501B4a559b57D449569354196457D8Ab") as `0x${string}`,
  name: "USDC", // Actual name from HyperEVM testnet USDC contract
  symbol: "USDC",
  decimals: 6,
  version: "2", // EIP-712 version for USDC
};

// EIP-3009 Authorization Types (from x402)
export const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

// USDC ABI (EIP-3009 functions)
export const usdcABI = [
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
      { internalType: "uint256", name: "validAfter", type: "uint256" },
      { internalType: "uint256", name: "validBefore", type: "uint256" },
      { internalType: "bytes32", name: "nonce", type: "bytes32" },
      { internalType: "bytes", name: "signature", type: "bytes" },
    ],
    name: "transferWithAuthorization",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "version",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "DOMAIN_SEPARATOR",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

