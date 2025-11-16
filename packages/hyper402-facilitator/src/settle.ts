/**
 * Hyper402 Settle - Settlement logic using CDP Server Wallets
 */

import { CdpClient } from "@coinbase/cdp-sdk";
import { encodeFunctionData, createWalletClient, http, createPublicClient, type Address, type Hex } from "viem";
import { toAccount } from "viem/accounts";
import type { PaymentPayload, PaymentRequirements, SettleResponse, ExactEvmPayload } from "./types.js";
import { verify } from "./verify.js";
import { USDC_CONFIG, usdcABI, HYPEREVM_TESTNET_CONFIG } from "./config.js";

/**
 * Settle a payment by executing transferWithAuthorization via CDP Server Wallet
 */
export async function settle(
  cdp: CdpClient,
  facilitatorAddress: `0x${string}`,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<SettleResponse> {
  const payload = paymentPayload.payload as ExactEvmPayload;

  try {
    // Re-verify to ensure payment is still valid
    const verifyResult = await verify(paymentPayload, paymentRequirements);

    if (!verifyResult.isValid) {
      return {
        success: false,
        network: paymentPayload.network,
        transaction: "",
        errorReason: verifyResult.invalidReason ?? "invalid_scheme",
        payer: payload.authorization.from,
      };
    }

    console.log(`[Hyper402] Settling payment from ${payload.authorization.from}`);
    console.log(`[Hyper402] Amount: ${payload.authorization.value} (${paymentRequirements.maxAmountRequired} required)`);
    console.log(`[Hyper402] To: ${payload.authorization.to}`);

    // Encode transferWithAuthorization call data
    const callData = encodeFunctionData({
      abi: usdcABI,
      functionName: "transferWithAuthorization",
      args: [
        payload.authorization.from as Address,
        payload.authorization.to as Address,
        BigInt(payload.authorization.value),
        BigInt(payload.authorization.validAfter),
        BigInt(payload.authorization.validBefore),
        payload.authorization.nonce as Hex,
        payload.signature as Hex,
      ],
    });

    // Get CDP account and convert to viem account (works on any EVM chain!)
    const cdpAccount = await cdp.evm.getOrCreateAccount({
      name: "hyperpay-facilitator", // Using original name to reuse funded wallet
    });
    
    const hyperEvmChain = {
      id: HYPEREVM_TESTNET_CONFIG.chainId,
      name: HYPEREVM_TESTNET_CONFIG.name,
      nativeCurrency: HYPEREVM_TESTNET_CONFIG.nativeCurrency,
      rpcUrls: {
        default: { http: [HYPEREVM_TESTNET_CONFIG.rpcUrl] },
        public: { http: [HYPEREVM_TESTNET_CONFIG.rpcUrl] },
      },
    };

    // Create viem wallet client using CDP account (via toAccount)
    const walletClient = createWalletClient({
      account: toAccount(cdpAccount),
      chain: hyperEvmChain,
      transport: http(HYPEREVM_TESTNET_CONFIG.rpcUrl),
    });

    // Send transaction using viem (works on any EVM chain!)
    const txHash = await walletClient.sendTransaction({
      to: USDC_CONFIG.address,
      data: callData,
      value: 0n,
    });

    // Wait for confirmation
    const publicClient = createPublicClient({
      chain: hyperEvmChain,
      transport: http(HYPEREVM_TESTNET_CONFIG.rpcUrl),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    console.log(`[Hyper402] Transaction submitted: ${txHash}`);
    console.log(`[Hyper402] Settlement successful! Status: ${receipt.status}`);

    return {
      success: receipt.status === "success",
      transaction: txHash,
      network: paymentPayload.network,
      payer: payload.authorization.from,
    };
  } catch (error) {
    console.error("[Hyper402] Settlement error:", error);
    return {
      success: false,
      errorReason: error instanceof Error ? error.message : "settlement_failed",
      transaction: "",
      network: paymentPayload.network,
      payer: payload.authorization.from,
    };
  }
}

