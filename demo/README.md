# HyperPay demo

To showcase HyperPay's x402 facilitator on HyperEVM, I've also included this End-to-end demo

## what this demo shows

this demo illustrates a complete payment flow using HyperPay:

1. **web client** - CDP Embedded Wallet with email/SMS/Google/X authentication
2. **demo API** - simple Express server with x402 payment protection
3. **HyperPay facilitator** - verifies and settles payments on HyperEVM testnet

## running the Demo

**pre-reqs:** HyperPay facilitator must be running (see main README on how to do this)

### 1. start demo API

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your RECEIVER_WALLET
npm run dev
```

the demo API server runs on http://localhost:3003

### 2. start web client

```bash
cd client
npm install
cp .env.local.example .env.local
# Edit .env.local with your CDP_PROJECT_ID
npm run dev
```

the web client runs on http://localhost:3004

### 3. try it out

1. open http://localhost:3004
2. sign in (creates CDP Embedded Wallet)
3. get testnet USDC from Circle's faucet
4. click "Get Motivational Quote"
5. payment happens automatically on HyperEVM

## payment flow

```
Client → API: GET /motivate
API → Client: 402 Payment Required (0.01 USDC on HyperEVM)
Client: Creates EIP-3009 authorization, signs with CDP wallet
Client → API: GET /motivate + X-PAYMENT header
API → HyperPay: POST /verify
HyperPay: Validates signature, checks balance
API → HyperPay: POST /settle
HyperPay: Calls transferWithAuthorization via CDP Server Wallet
         Pays gas in HYPE, transfers USDC
API → Client: 200 OK + quote + transaction details
```

## so what?

- 🔥 first x402 facilitator for HyperEVM
- 🔥 uses CDP Server Wallets for facilitator-based gas sponsorship => no one has to think about gas
- 🔥 uses standard x402 protocol (works with x402-express)
- 🔥 provides a complete, forkable reference implementation to help other builders move faster

## endpoints

**demo API** (http://localhost:3003):
- `GET /` - API info
- `GET /health` - health check
- `GET /motivate` - simple motivational quote (requires 0.01 USDC on HyperEVM testnet)
- `GET /fortune` - fortune-telling (requires 0.05 USDC on HyperEVM testnet)

both x402-enabled API examples accept payment on HyperEVM testnet via the HyperPay facilitator

