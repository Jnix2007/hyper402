/**
 * Hyper402 Facilitator Server
 * Provides /verify and /settle endpoints for x402 payments on HyperEVM testnet
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { CdpClient } from "@coinbase/cdp-sdk";
import { verify } from "./verify.js";
import { settle } from "./settle.js";
import { USDC_CONFIG } from "./config.js";
import type { VerifyRequest, SettleRequest } from "./types.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize CDP Client
const cdp = new CdpClient();

// Facilitator wallet address (will be created on first run if not exists)
let facilitatorAddress: `0x${string}`;

// Initialize facilitator wallet
async function initializeFacilitator() {
  try {
    // Try to get or create a facilitator account
    // Using original wallet name to reuse funded wallet from HyperPay
    const account = await cdp.evm.getOrCreateAccount({
      name: "hyperpay-facilitator",
    });
    
    facilitatorAddress = account.address;
    console.log(`✅ Facilitator wallet initialized: ${facilitatorAddress}`);
    console.log(`⚠️  Make sure this wallet has HYPE for gas on HyperEVM testnet!`);
  } catch (error) {
    console.error("Failed to initialize facilitator wallet:", error);
    throw error;
  }
}

// Root endpoint - info about the facilitator
app.get("/", (req, res) => {
  res.json({
    name: "Hyper402 Facilitator",
    version: "1.0.0",
    description: "x402 payment facilitator for HyperEVM testnet",
    network: {
      name: "HyperEVM Testnet",
      chainId: 998,
      currency: "HYPE",
    },
    supported: {
      scheme: "exact",
      network: "hyperevm-testnet",
      asset: "USDC (0x2B3370eE501B4a559b57D449569354196457D8Ab)",
    },
    endpoints: {
      "POST /verify": "Verify a payment payload",
      "POST /settle": "Settle a verified payment",
      "GET /supported": "Get supported schemes and networks",
    },
    facilitatorWallet: facilitatorAddress,
    github: "https://github.com/jnix2007/hyper402",
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    facilitatorWallet: facilitatorAddress,
    message: "Hyper402 facilitator is running" 
  });
});

// Get supported schemes and networks
app.get("/supported", (req, res) => {
  res.json({
    kinds: [
      {
        x402Version: 1,
        scheme: "exact",
        network: "hyperevm-testnet",
      },
    ],
  });
});

// Verify endpoint
app.post("/verify", async (req, res) => {
  try {
    const request = req.body as VerifyRequest;

    if (!request.paymentPayload || !request.paymentRequirements) {
      return res.status(400).json({
        error: "Missing paymentPayload or paymentRequirements",
      });
    }

    console.log(`[Hyper402] Verifying payment from ${(request.paymentPayload.payload as any).authorization.from}`);

    const result = await verify(
      request.paymentPayload,
      request.paymentRequirements,
    );

    console.log(`[Hyper402] Verification result: ${result.isValid ? "VALID ✅" : `INVALID ❌ (${result.invalidReason})`}`);

    res.json(result);
  } catch (error) {
    console.error("[Hyper402] Verify error:", error);
    res.status(500).json({
      isValid: false,
      invalidReason: "unexpected_verify_error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// Settle endpoint
app.post("/settle", async (req, res) => {
  try {
    const request = req.body as SettleRequest;

    if (!request.paymentPayload || !request.paymentRequirements) {
      return res.status(400).json({
        error: "Missing paymentPayload or paymentRequirements",
      });
    }

    console.log(`[Hyper402] Settling payment from ${(request.paymentPayload.payload as any).authorization.from}`);

    if (!facilitatorAddress) {
      throw new Error("Facilitator wallet not initialized");
    }

    const result = await settle(
      cdp,
      facilitatorAddress,
      request.paymentPayload,
      request.paymentRequirements,
    );

    console.log(`[Hyper402] Settlement result: ${result.success ? "SUCCESS ✅" : `FAILED ❌ (${result.errorReason})`}`);
    if (result.transaction) {
      console.log(`[Hyper402] Transaction: https://testnet.purrsec.com/tx/${result.transaction}`);
    }

    res.json(result);
  } catch (error) {
    console.error("[Hyper402] Settle error:", error);
    res.status(500).json({
      success: false,
      errorReason: "settlement_failed",
      error: error instanceof Error ? error.message : "Unknown error",
      network: "hyperevm-testnet",
    });
  }
});

// Start server
async function start() {
  try {
    await initializeFacilitator();
    
    app.listen(PORT, () => {
      console.log(`\n🚀 Hyper402 Facilitator running on http://localhost:${PORT}`);
      console.log(`\n📋 Endpoints:`);
      console.log(`   • GET  /              - Facilitator info`);
      console.log(`   • GET  /health        - Health check`);
      console.log(`   • GET  /supported     - Supported schemes`);
      console.log(`   • POST /verify        - Verify payment`);
      console.log(`   • POST /settle        - Settle payment`);
      console.log(`\n🔧 Configuration:`);
      console.log(`   • Network: HyperEVM Testnet (Chain ID 998)`);
      console.log(`   • Scheme: exact (EIP-3009)`);
      console.log(`   • Token: USDC (${USDC_CONFIG.address})`);
      console.log(`   • Facilitator: ${facilitatorAddress}`);
      console.log(`\n💡 Make sure facilitator wallet has HYPE for gas!`);
    });
  } catch (error) {
    console.error("Failed to start facilitator:", error);
    process.exit(1);
  }
}

start();

