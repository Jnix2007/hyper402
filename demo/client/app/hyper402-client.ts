/**
 * Custom x402 client for HyperEVM
 * Bypasses x402-fetch to avoid hardcoded network validation
 */

import type { WalletClient } from "viem";
import { signEvmTypedData } from "@coinbase/cdp-core";

interface PaymentRequirement {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  asset: string;
  payTo: string;
  resource: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  extra?: {
    name?: string;
    version?: string;
  };
}

interface PaymentResponse {
  success: boolean;
  transaction?: string;
  network?: string;
  payer?: string;
}

/**
 * Make a paid request using custom x402 implementation
 */
export async function makePaidRequest(
  url: string,
  walletClient: WalletClient,
  evmAccount: string,
): Promise<{ data: any; paymentInfo?: PaymentResponse }> {
  
  // 1. Initial request
  const initialResponse = await fetch(url);
  
  // If not 402, return the response
  if (initialResponse.status !== 402) {
    return { data: await initialResponse.json() };
  }

  // 2. Parse payment requirements
  const paymentData = await initialResponse.json();
  const requirement: PaymentRequirement = paymentData.accepts[0];

  console.log("[Hyper402 Client] Payment required:", requirement);

  // 3. Create EIP-3009 authorization
  const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')}`;

  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

  const domain = {
    name: requirement.extra?.name || "USDC", // Actual name from HyperEVM testnet USDC contract
    version: requirement.extra?.version || "2",
    chainId: 998,
    verifyingContract: requirement.asset,
  };

  console.log("[Hyper402 Client] EIP-712 Domain:", domain);
  console.log("[Hyper402 Client] Message:", {
    from: walletClient.account.address,
    to: requirement.payTo,
    value: requirement.maxAmountRequired,
    validAfter,
    validBefore,
    nonce,
  });

  // 4. Sign with EIP-712 using CDP (avoids BigInt serialization issues)
  const result = await signEvmTypedData({
    evmAccount,
    typedData: {
      domain,
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "TransferWithAuthorization",
      message: {
        from: walletClient.account.address,
        to: requirement.payTo,
        value: requirement.maxAmountRequired,
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  });
  
  const signature = result.signature;

  console.log("[Hyper402 Client] Created payment authorization and signature");

  // 5. Create X-PAYMENT header
  const paymentPayload = {
    x402Version: 1,
    scheme: "exact",
    network: "hyperevm-testnet", // Use real network!
    payload: {
      signature,
      authorization: {
        from: walletClient.account.address,
        to: requirement.payTo,
        value: requirement.maxAmountRequired,
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
    },
  };

  const paymentHeader = btoa(JSON.stringify(paymentPayload));

  // 6. Retry request with payment
  const paidResponse = await fetch(url, {
    headers: {
      'X-PAYMENT': paymentHeader,
    },
  });

  if (!paidResponse.ok) {
    throw new Error(`Payment failed: ${paidResponse.status}`);
  }

  // 7. Parse payment response
  const paymentResponseHeader = paidResponse.headers.get('X-PAYMENT-RESPONSE');
  let paymentInfo: PaymentResponse | undefined;
  
  if (paymentResponseHeader) {
    try {
      paymentInfo = JSON.parse(atob(paymentResponseHeader));
    } catch (e) {
      console.error("Failed to parse payment response:", e);
    }
  }

  const data = await paidResponse.json();
  
  console.log("[Hyper402 Client] Payment successful!", paymentInfo);

  return { data, paymentInfo };
}

