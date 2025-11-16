# Hyper402 - x402 Facilitator for HyperEVM

![Hyper402](./hyper402.png)

**Hyper402 is the first x402 payment facilitator for HyperEVM**, enabling API services and content providers to monetize their offerings and receive onchain payments on HyperEVM

**built for the HyperEVM Hackathon hosted by Looping Collective & StakingRewards at Devconnect Buenos Aires, November 2025**

## what is Hyper402?

Hyper402 is a self-hosted x402 facilitator that brings the x402 payment protocol to HyperEVM, starting on testnet but easily configurable for mainnet

it enables API providers to accept USDC payments on HyperEVM using the same dead-simple integration other facilitators provide on chains like Solana and Base

### features

✅ **EIP-3009 compatible** - gasless payments using `transferWithAuthorization`  
✅ **CDP Server Wallets** - secure key management and automatic nonce & retry handling 
✅ **standard x402 protocol** - works with existing x402 client libraries  
✅ **production-ready** - full verification and settlement logic  
✅ **open source** - template for adding x402 to any EVM chain  

## high-level architecture

my core contribution here is the x402 Facilitator for HyperEVM

**along with the facilitator, I've included an end-to-end, full-stack demo showcasing HyperEVM x402 payments in action**:

- web app lets the user sign in, get a CDP Embedded Wallet, and faucet USDC on HyperEVM testnet
- the user can one-click call a simple x402-enabled API running in the backend, which uses Hyper402's facilitator on HyperEVM
- the API will respond with 402 payment required, directing the user to pay $0.01 USDC on HyperEVM testnet to access its services
- the client wallet signs and retries using the X-PAYMENT header the x402 protocol expects
- the API server calls Hyper402's facilitator to verify and settle payment on HyperEVM
- with payment complete, the API provides the requested service/content to the user


```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│    client    │         │   demo API   │         │   Hyper402   │
│              │◄───────►│              │◄───────►│ (facilitator)│
└──────────────┘         └──────────────┘         └──────────────┘
                                                          │
                                                          ▼
                                                   ┌──────────────┐
                                                   │ CDP Server   │
                                                   │   Wallet     │
                                                   └──────┬───────┘
                                                          │
                                                          ▼
                                                   ┌──────────────┐
                                                   │  HyperEVM    │
                                                   │   testnet    │
                                                   └──────────────┘
```

## project structure

```
hyper402/
├── packages/
│   └── hyper402-facilitator/    # facilitator implementation
│       ├── src/
│       │   ├── server.ts        # express server with /verify & /settle
│       │   ├── verify.ts        # payment verification logic
│       │   ├── settle.ts        # settlement via CDP Server Wallets
│       │   ├── config.ts        # HyperEVM & USDC configuration
│       │   ├── types.ts         # TypeScript interfaces
│       │   └── index.ts         # exports facilitator instance
│       └── package.json
└── demo/
    ├── server/                   # demo API using Hyper402
    │   ├── index.js             # express API with x402 middleware
    │   └── package.json
    └── client/                   # web app
        ├── app/                 # next.js app with CDP Embedded Wallet
        └── package.json
```

## quickstart

### pre-reqs

1. Node.js v18+
2. CDP API Key from https://portal.cdp.coinbase.com/
3. CDP Server Wallet with HYPE on HyperEVM testnet to pay gas fees (I used gas.zip and Quicknode Faucet)

### 1. install dependencies

```bash
npm install
```

### 2. configure Hyper402 facilitator

```bash
cd packages/hyper402-facilitator
cp .env.example .env
```

Edit `.env`:
```env
CDP_API_KEY_ID=your-api-key-id
CDP_API_KEY_SECRET=your-api-key-secret
PORT=3002
```

### 3. build the facilitator

```bash
cd packages/hyper402-facilitator
npm run build
cd ../..
```

### 4. start Hyper402 facilitator

```bash
npm run dev:facilitator
```

you should see:
```
✅ Facilitator wallet initialized: 0x...
⚠️  Make sure this wallet has HYPE for gas!
🚀 Hyper402 Facilitator running on http://localhost:3002
```

**important:** fund the facilitator wallet with testnet HYPE for gas!

### 5. configure demo API

```bash
cd demo/server
cp .env.example .env
```

Edit `.env`:
```env
RECEIVER_WALLET=0xYourWalletAddressHere
HYPER402_FACILITATOR_URL=http://localhost:3002
```

### 6. start demo API server

```bash
npm run dev:server
```

### 7. configure client

```bash
cd demo/client
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_CDP_PROJECT_ID=your-project-id
NEXT_PUBLIC_API_URL=http://localhost:3003
```

### 8. start client

```bash
npm run dev:client
```

visit http://localhost:3004 - you can sign in and experience the end-to-end flow using Hyper402

## how it works

### for API providers

as the hackathon project P0, integration requires custom middleware (~20 lines) since the standard x402 middleware package doesn't support custom chains yet - see `demo/server/index.js` for the full implementation

**future state** (after publishing Hyper402 custom middleware; see roadmap below):

```javascript
import { paymentMiddleware } from "@hyper402/x402-express";
import { facilitator } from "@hyper402/facilitator";

app.use(paymentMiddleware(
  "0xYourWallet",
  {
    "GET /api": {
      price: "$0.01",
      network: "hyperevm-testnet"
    }
  },
  facilitator
));
```

### for users & agents

1. sign in (supports various web2-friendly auth methods), get a CDP Embedded Wallet under the hood
2. get HyperEVM testnet USDC from Circle's faucet
3. call paid APIs, paying via x402

## tech details

### HyperEVM testnet configuration

- **chain id:** 998
- **RPC:** https://rpc.hyperliquid-testnet.xyz/evm
- **native token:** HYPE (for gas)
- **USDC contract:** `0x2B3370eE501B4a559b57D449569354196457D8Ab`
- **explorer:** https://testnet.purrsec.com/

### payment flow

1. client requests API endpoint
2. server returns 402 with payment requirements
3. client creates EIP-3009 authorization (signed off-chain)
4. client retries with X-PAYMENT header
5. server calls Hyper402 `/verify`
6. Hyper402 verifies signature & checks balance
7. server calls Hyper402 `/settle`
8. Hyper402 calls `transferWithAuthorization` via CDP Server Wallet
9. CDP Server Wallet pays gas (HYPE)
10. USDC transfers from client to API provider
11. server returns protected content

### why Hyper402 matters

**for the x402 ecosystem:**
- first facilitator beyond Base & Solana
- proves x402 works on any EVM chain
- reference implementation for other chains

**for HyperEVM:**
- enables API monetization on HyperEVM
- showcases EVM compatibility
- drives HYPE usage
- attracts developers building paid services

**for CDP:**
- demonstrates Server Wallets on HyperEVM
- shows Embedded Wallet flexibility

## deployment

I haven't deployed this to production yet, but here's how you would do it. Right now I'm focused on testing locally, and don't want to deploy before doing that - but maybe you can!

### facilitator

environment variables:
- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET`
- `HYPEREVM_RPC_URL`

### demo API

environment variables:
- `RECEIVER_WALLET`
- `HYPER402_FACILITATOR_URL`

### client

environment variables:
- `NEXT_PUBLIC_CDP_PROJECT_ID`
- `NEXT_PUBLIC_API_URL`

don't forget to allowlist your domain in CDP Portal under Embedded Wallets! The web app demo won't work without that

## roadmap

I mostly built Hyper402 on the long flight from Seattle to Buenos Aires, so the scope is limited. There are a ton of future directions I might take this, or that you can feel free to explore! Some ideas below -

### immediate next steps

1. **`@hyper402/client` payment library** - Extract the custom client implementation (`demo/client/app/hyper402-client.ts`) into a reusable npm package:
   - Clean TypeScript API for x402 payments on custom chains
   - Works with any EVM chain (not just HyperEVM)
   - Developers can use it instead of x402-fetch
   - Pair with any x402 facilitator

2. **`@hyper402/express` server middleware** - Extract the custom server middleware into a package:
   - Works like x402-express but supports custom EVM chains
   - API providers get back to 3-line integration
   - Combined with hosted Hyper402 facilitator = dead-simple

### production deployment

3. **production HyperEVM facilitator** - Deploy Hyper402 as a production-grade facilitator on HyperEVM mainnet with:
   - fleet of CDP Server Wallets for high throughput and redundancy while minimizing error rate
   - intelligent load balancing across multiple facilitator instances
   - monitoring, alerting, and analytics dashboard
   - rate limiting and abuse prevention
   - uptime SLA guarantees

4. **monetization features** - Turn Hyper402 into a sustainable business:
   - optional facilitator fees (e.g., 0.1% of transaction value, or flat rate per settled txn)
   - premium tier with higher throughput guarantees
   - analytics and insights for API providers
   - webhook notifications for payment events

### advanced features

5. **multi-token support** - accept and disburse in any token:
   - native token swaps via HyperEVM DEXes
   - users pay in any HyperEVM-supported token they have (USDC, HYPE, wBTC, etc)
   - API providers receive in their preferred token
   - automatic conversion handled by facilitator; neither party has to think about the swap in between
   - route optimization for best swap rates

6. **Looping Collective integration** 🔄 - yield on API revenue:
   - enable API providers to auto-deposit a % of earnings into a liquid looping strategy like LHYPE
   - earn yield on revenue while maintaining liquidity
   - configurable allocation (e.g. 50% liquid, 50% looped or whatever)
   - dashboard showing revenue + accumulated yield
   - one-click withdrawal from looping positions

7. **HyperCore support** - extend Hyper402 beyond HyperEVM:
   - implement x402 facilitator for HyperCore (Hyperliquid L1)
   - enable cross-chain payments (pay on HyperCore, settle on HyperEVM)
   - unified facilitator handling both chains with configurability
   - would demonstrate x402's multi-chain flexibility and drive more Hyperliquid usage

### ecosystem expansion

8. **discovery layer** - HyperEVM API marketplace:
   - catalog of x402-enabled APIs on HyperEVM
   - searchable by category, price, rating
   - one-click integration for developers
   - revenue leaderboard for top APIs

### community & governance

9. **open governance** - decentralize Hyper402:
    - DAO for facilitator parameters (fees, supported tokens)
    - community-run facilitator nodes
    - revenue sharing with node operators
    - grants for ecosystem development

the core contribution here — a working x402 facilitator for HyperEVM — is a foundation that can grow into critical infrastructure for a rich API economy settling on Hyperliquid & HyperEVM 🔥

## learnings & key insights

### x402 hardcoded network limitations (client AND server)

**insight:** the entire x402 stack has hardcoded network enums:
- **server side:** `x402-express` middleware rejects custom networks
- **client side:** `x402-fetch` also validates networks via zod schema
- both only allow: Base, Base Sepolia, Solana, Solana Devnet, afaict
- custom EVM chains like HyperEVM testnet are rejected at BOTH ends

**final solution:** Implemented x402 protocol from scratch for both client and server (~180 lines total):

**Server** (`demo/server/index.js` ~50 lines):
- Custom middleware that detects protected endpoints
- Returns 402 with proper payment requirements
- Calls Hyper402 facilitator's /verify and /settle
- Adds X-PAYMENT-RESPONSE header

**Client** (`demo/client/app/hyper402-client.ts` ~130 lines):
- Detects 402 responses
- Creates EIP-3009 transferWithAuthorization payload
- Signs EIP-712 with correct chain ID 998
- Constructs X-PAYMENT header
- Retries request with payment

**why custom implementation won:**
- ✅ Full control over chain ID and network handling
- ✅ No fighting with hardcoded library validation
- ✅ Demonstrates deep x402 protocol understanding
- ✅ Clean, readable code for judges to review
- ✅ Proved to be simpler than workarounds

**attempted workarounds (all failed):**
- Deceiving client about network → EIP-712 chain ID mismatch caused signature failures
- Type casting and @ts-ignore → TypeScript errors persisted
- Various middleware hacks → libraries too opinionated for custom chains

**key lesson:** Sometimes it's faster to implement a clean spec yourself than to fight well-intentioned libraries designed for different constraints. The x402 *protocol* is elegant and chain-agnostic; the *libraries* assume a closed ecosystem.

**solution ideas for x402 ecosystem:** x402 packages need architectural changes, which I think the x402 v2 spec is tackling:
- making network validation extensible (plugin system for custom chains)
- adding "custom EVM" network type with runtime chain ID configuration
- accepting any network string and delegating validation to the facilitator
- or removing client-side network validation entirely (trust the facilitator)

### middleware vs direct integration tradeoff

**the question:** if API providers can't use simple middleware b/c of network restrictions, does that mean they must self-host the Hyper402 facilitator (risking easy integration)?

**the answer:** not necessarily - here are some options:

1. **deploy Hyper402 as a hosted facilitator service** (like CDP does for its facilitator):
   - run facilitator at some hosted endpoint
   - API providers call your hosted facilitator directly
   - they implement custom middleware (like we did in demo/server)
   - still only ~20 lines of code (not as clean as 3-line middleware, but manageable)

2. **create custom `x402-hyperevm` middleware package**:
   - fork x402-express
   - add HyperEVM support
   - publish as `@hyper402/x402-express`
   - now sellers can use: `import { paymentMiddleware } from "@hyper402/x402-express"`

3. **contribute to x402 core repo**:
   - submit PR to x402 repo to add custom chain support
   - if accepted, future versions would support any EVM chain
   - this would benefit the entire ecosystem - but expect x402's in-fight v2 effort should address

**recommendation:** see if option 3 works, then maybe option 2 - for now option 1 is immediately available

### EIP-712 domain parameter differences across chains

**challenge:** USDC contracts on different chains use different EIP-712 domain names, causing signature validation failures.

**finding:** HyperEVM's USDC contract uses:
- `name: "USDC"` 
- `version: "2"`

While other chains (like Base) use:
- `name: "USD Coin"`
- `version: "2"`

**impact:** Initial signatures failed with "invalid signature" errors because we assumed all USDC deployments used "USD Coin". The EIP-712 signature must match the exact contract's domain parameters.

**solution:** Query the contract directly to get actual values:
```javascript
const name = await usdcContract.read.name();    // "USDC" on HyperEVM
const version = await usdcContract.read.version(); // "2"
```

**lesson:** Never assume EIP-712 domain parameters - always verify from the contract, especially when bridging to new chains. Small differences break signatures.

### testnet faucet challenges

**challenge:** getting testnet HYPE was surprisingly difficult during the hackathon; most faucets had strict requirements:
- Quicknode faucet: Requires 0.05 HYPE on Hyperliquid mainnet
- Chainstack faucet: Requires 0.08 ETH on Ethereum mainnet + some mainnet activity history
- these anti-abuse measures are understandable but create barriers for legitimate hackathon projects

**solution:** used gas.zip and eventually Quicknode faucet

**insight:** hackathons and testnets need dedicated builder faucets with different access patterns (e.g. Discord verification, GitHub account age, etc) rather than mainnet balance requirements

## license

MIT

## links

- [x402 protocol](https://www.x402.org/)