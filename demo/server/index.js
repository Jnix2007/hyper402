import express from "express";
import cors from "cors";
import { createPublicClient, http } from "viem";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Parse JSON bodies
app.use(express.json());

// Enable CORS
app.use(cors());

// Your wallet address that will receive payments
const RECEIVER_WALLET = process.env.RECEIVER_WALLET || "0xYourWalletAddress";
const FACILITATOR_URL = process.env.HYPER402_FACILITATOR_URL || "http://localhost:3002";

// USDC configuration for HyperEVM testnet
const USDC_CONFIG = {
  address: "0x2B3370eE501B4a559b57D449569354196457D8Ab",
  decimals: 6,
  eip712: {
    name: "USDC", // Actual name from HyperEVM testnet USDC contract
    version: "2"
  }
};

// Payment configuration for each endpoint
const PAYMENT_CONFIG = {
  "/motivate": {
    amount: "10000", // 0.01 USDC
    description: "Get a motivational quote"
  },
  "/fortune": {
    amount: "50000", // 0.05 USDC
    description: "Get your fortune told"
  }
};

// x402 payment middleware for HyperEVM
async function x402Middleware(req, res, next) {
  const config = PAYMENT_CONFIG[req.path];
  
  if (!config) {
    return next(); // Not a protected endpoint
  }

  const paymentHeader = req.headers['x-payment'];
  
  // No payment header - return 402
  if (!paymentHeader) {
    const paymentRequirement = {
      scheme: "exact",
      network: "hyperevm-testnet", // Use real network since we have custom client
      maxAmountRequired: config.amount,
      asset: USDC_CONFIG.address,
      payTo: RECEIVER_WALLET,
      resource: `${req.protocol}://${req.headers.host}${req.path}`,
      description: config.description,
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      extra: {
        name: USDC_CONFIG.eip712.name,
        version: USDC_CONFIG.eip712.version
      }
    };
    
    return res.status(402).json({
      accepts: [paymentRequirement]
    });
  }

  // Payment provided - verify and settle
  try {
    const paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
    
    const paymentRequirements = {
      scheme: "exact",
      network: "hyperevm-testnet",
      maxAmountRequired: config.amount,
      asset: USDC_CONFIG.address,
      payTo: RECEIVER_WALLET,
      resource: `${req.protocol}://${req.headers.host}${req.path}`,
      description: config.description,
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      extra: {
        name: USDC_CONFIG.eip712.name,
        version: USDC_CONFIG.eip712.version
      }
    };

    // Verify with facilitator
    const verifyResponse = await fetch(`${FACILITATOR_URL}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 1,
        paymentPayload,
        paymentRequirements
      })
    });

    const verifyResult = await verifyResponse.json();

    if (!verifyResult.isValid) {
      return res.status(402).json({
        error: "Invalid payment",
        reason: verifyResult.invalidReason
      });
    }

    // Settle with facilitator
    const settleResponse = await fetch(`${FACILITATOR_URL}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 1,
        paymentPayload,
        paymentRequirements
      })
    });

    const settleResult = await settleResponse.json();

    if (!settleResult.success) {
      return res.status(500).json({
        error: "Settlement failed",
        reason: settleResult.errorReason
      });
    }

    // Add payment response header
    const paymentResponse = Buffer.from(JSON.stringify({
      success: true,
      transaction: settleResult.transaction,
      network: "hyperevm-testnet",
      payer: settleResult.payer
    })).toString('base64');

    res.setHeader('X-PAYMENT-RESPONSE', paymentResponse);

    // Payment successful - continue to endpoint
    next();

  } catch (error) {
    console.error("Payment processing error:", error);
    res.status(500).json({ error: "Payment processing failed" });
  }
}

// Apply custom x402 middleware
app.use(x402Middleware);

// Protected endpoints
app.get("/motivate", (req, res) => {
  res.json({
    quote: "Work hard, have fun, make history.",
    timestamp: new Date().toISOString(),
    paid: true,
    network: "hyperevm-testnet"
  });
});

app.get("/fortune", (req, res) => {
  const fortunes = [
    "Great success awaits you in the crypto markets.",
    "Your next deploy will be bug-free.",
    "A generous airdrop is in your future.",
    "Your code will compile on the first try today.",
    "You will discover an innovative use case for liquid looping.",
  ];
  
  res.json({
    fortune: fortunes[Math.floor(Math.random() * fortunes.length)],
    luckyNumber: Math.floor(Math.random() * 100),
    timestamp: new Date().toISOString(),
    paid: true,
    network: "hyperevm-testnet"
  });
});

// Public endpoints
app.get("/", (req, res) => {
  res.json({
    name: "Hyper402 Demo API",
    description: "Demo API showcasing x402 payments on HyperEVM testnet",
    facilitator: "Hyper402 (custom facilitator for HyperEVM)",
    endpoints: {
      "GET /health": "Health check",
      "GET /balance/:address": "Get USDC balance",
      "GET /motivate": "Get motivational quote (requires 0.01 USDC payment)",
      "GET /fortune": "Get your fortune (requires 0.05 USDC payment)"
    },
    network: {
      name: "HyperEVM Testnet",
      chainId: 998,
      paymentToken: "USDC"
    },
    github: "https://github.com/jnix2007/hyper402"
  });
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Hyper402 demo API is running",
    receivingPayments: RECEIVER_WALLET
  });
});

// Balance endpoint - Get USDC balance on HyperEVM testnet via RPC
app.get("/balance/:address", async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }

    // Create public client for HyperEVM testnet
    const publicClient = createPublicClient({
      chain: {
        id: 998,
        name: "HyperEVM Testnet",
        nativeCurrency: { name: "HYPE", symbol: "HYPE", decimals: 18 },
        rpcUrls: {
          default: { http: ["https://rpc.hyperliquid-testnet.xyz/evm"] },
          public: { http: ["https://rpc.hyperliquid-testnet.xyz/evm"] },
        },
      },
      transport: http("https://rpc.hyperliquid-testnet.xyz/evm"),
    });

    // Read USDC balance
    const usdcAddress = "0x2B3370eE501B4a559b57D449569354196457D8Ab";
    const balance = await publicClient.readContract({
      address: usdcAddress,
      abi: [{
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      }],
      functionName: "balanceOf",
      args: [address],
    });

    // Convert to decimal (USDC has 6 decimals)
    const balanceInUsdc = Number(balance) / 1000000;

    res.json({ 
      balance: balanceInUsdc.toString(),
      address: address,
      network: "hyperevm-testnet",
      token: "USDC"
    });
  } catch (error) {
    console.error("Balance error:", error);
    res.status(500).json({ 
      error: error.message || "Failed to fetch balance"
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Hyper402 Demo API running on http://localhost:${PORT}`);
  console.log(`\n📋 Protected Endpoints:`);
  console.log(`   • GET /motivate  - 0.01 USDC on HyperEVM testnet`);
  console.log(`   • GET /fortune   - 0.05 USDC on HyperEVM testnet`);
  console.log(`\n💰 Receiving payments at: ${RECEIVER_WALLET}`);
  console.log(`🔧 Using Hyper402 facilitator at: ${FACILITATOR_URL}`);
  console.log(`\n💡 Make sure Hyper402 facilitator is running!`);
});
