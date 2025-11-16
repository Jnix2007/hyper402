import { createPublicClient, http } from "viem";

const client = createPublicClient({
  chain: {
    id: 998,
    rpcUrls: {
      default: { http: ["https://rpc.hyperliquid-testnet.xyz/evm"] },
    },
  },
  transport: http("https://rpc.hyperliquid-testnet.xyz/evm"),
});

const usdcAddress = "0x2B3370eE501B4a559b57D449569354196457D8Ab";

async function checkUSMDC() {
  // Get name
  const name = await client.readContract({
    address: usdcAddress,
    abi: [{
      name: "name",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ name: "", type: "string" }],
    }],
    functionName: "name",
  });

  // Get version
  const version = await client.readContract({
    address: usdcAddress,
    abi: [{
      name: "version",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ name: "", type: "string" }],
    }],
    functionName: "version",
  });

  console.log("USDC Name:", name);
  console.log("USDC Version:", version);
}

checkUSMDC().catch(console.error);

