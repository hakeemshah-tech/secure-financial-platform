# Secure Financial Platform

A full-stack Web3 investment and settlement platform: a **Next.js 16 / React 19** client paired with
a **Node.js + TypeScript** backend that validates on-chain payment claims before they are allowed to
mutate financial state.

The platform lets users purchase SFT Token positions against multi-chain EVM payment rails,
tracks accrual and referral earnings through a binary tree structure, and routes withdrawals and
swaps through an administrative approval workflow, with every value-bearing state transition gated
on a transaction-hash uniqueness check.

> This is a sanitized public snapshot. See [Governance & NDA Compliance](#-governance--nda-compliance)
> at the bottom.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSER                                                        │
│                                                                 │
│  ┌───────────────────────┐      ┌───────────────────────────┐   │
│  │  Next.js App Router   │      │  Injected EVM Provider    │   │
│  │  28 routes · RSC      │◄────►│  (MetaMask / Freighter)   │   │
│  │  21 components        │      │  ethers v6 · signer       │   │
│  └───────────┬───────────┘      └─────────────┬─────────────┘   │
│              │                                 │                │
│    Zustand (persisted auth)          signed ERC-20 transfer     │
│    Axios interceptor (Bearer)                  │                │
└──────────────┼─────────────────────────────────┼────────────────┘
               │  JSON / HTTPS                   │
               │  Authorization: Bearer <JWT>    ▼
               │                        ┌──────────────────┐
               │                        │   EVM Network    │
               │                        │  (BNB / ETH / …) │
               │                        └────────┬─────────┘
               │                                 │
               │                        returns txHash to client
               │                                 │
               │◄────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────────┐
│  API: Express 5 + TypeScript (strict)                           │
│                                                                 │
│  helmet → cors(allowlist) → rateLimit → express.json            │
│                          │                                      │
│                          ▼                                      │
│  protect (JWT + live user re-fetch + isBlocked)                 │
│                          │                                      │
│                          ▼                                      │
│  12 route modules → 12 controllers                              │
│                          │                                      │
│                          ▼                                      │
│  ┌──────────────────────────────────────────────────┐           │
│  │  validationService.isTxHashUnique()              │           │
│  │  ── global replay guard, pre-write ──            │           │
│  └────────────────────────┬─────────────────────────┘           │
│                           ▼                                     │
│  incomeService  ·  auditLogger  ·  emailService  ·  FCM push    │
│                           │                                     │
│  node-cron: scheduled accrual + maturity sweeps                 │
└───────────────────────────┼─────────────────────────────────────┘
                            ▼
                ┌───────────────────────┐
                │  MongoDB / Mongoose   │
                │  11 models            │
                └───────────────────────┘
```

### Payment flow

The client never asserts that a payment happened and is believed. The sequence is deliberately
split so the server controls every side effect:

1. The client requests a purchase. The server creates an `Investment` in a **pending** state and
   returns the payout wallet bound to the selected plan.
2. The client signs an ERC-20 `transfer` through the user's own wallet. **No private key ever
   reaches the frontend**: the injected provider signs; the app only receives the resulting hash.
3. The client submits the `txHash` to confirm.
4. The server runs the replay guard (below), then transitions state and writes an audit record.

### Workspace layout

| Path | Role |
|---|---|
| `sft-client/` | Next.js 16 App Router frontend (React 19, Tailwind v4, Zustand, ethers v6) |
| `sft-server/` | Express 5 API, Mongoose models, cron accrual jobs, 25 maintenance scripts |
| `.env.example` | Single source of truth for required configuration |

---

## Security Posture

The controls below are the ones actually present in the committed source. Known gaps are stated
inline rather than elided.

### Transaction hash validation (`check_hash`)

An on-chain transaction hash is the platform's proof of payment. If one could be submitted twice, a
single real transfer could be credited against multiple investments, multiple swaps, or both,
minting balance out of nothing.

Uniqueness is therefore enforced **globally, across every collection capable of settling value**,
not per-collection:

```ts
// sft-server/src/services/validationService.ts
export const isTxHashUnique = async (
  txHash: string,
  excludeIds?: string | string[]
): Promise<boolean> => { … }
```

| Collection | Fields checked |
|---|---|
| `Transaction` | `txHash` |
| `Investment` | `txHash`, `sftTxHash` |
| `SwapRequest` | `userTxHash`, `adminTxHash` |

Design notes:

- **Invoked before the write**, on every value-bearing transition: purchase creation, payment
  confirmation, swap submission, withdrawal completion. A duplicate is rejected, never inserted
  and reconciled afterwards.
- **`excludeIds`** allows a record to exclude itself, so an update does not collide with its own
  stored hash.
- **Lazy model registration** via dynamic `import()` breaks the circular dependency between the
  service and the models that reference it, avoiding `MissingSchemaError` at load.

`sft-server/src/scripts/check_hash.ts` exposes the same lookup as an operator tool, answering
"has this hash already been consumed, and by what?" during support investigations:

```bash
npx tsx src/scripts/check_hash.ts <txHash>
```

> **Stated limitation.** This proves a hash has not been *reused*. It does **not** prove the hash
> corresponds to a confirmed on-chain transfer of the expected asset, amount, and recipient: there
> is no RPC receipt verification in this codebase. Any real deployment requires that step: resolving
> the hash against a node, confirming sufficient block confirmations, and asserting recipient, token
> contract and amount before crediting.

### Wallet address verification (`verify_wallet_field`)

A plan's `walletAddress` is a **fund-routing destination**. If it were silently truncated, stripped
by a serializer, or dropped by schema casting, nothing would throw: user payments would simply be
routed to an empty or stale address.

`sft-client/scripts/verify_wallet_field.ts` is an end-to-end contract test that makes that failure
mode loud: it creates a plan with a known wallet, reads it back through the public API, asserts
byte-identical equality, then deletes the record. Credentials come from the environment and the
script refuses to run without them.

```bash
VERIFY_ADMIN_EMAIL=… VERIFY_ADMIN_PASSWORD=… npx tsx scripts/verify_wallet_field.ts
```

At runtime, the server treats a client-supplied wallet as a *claim*, not as truth: in
`investmentController.createPurchaseRequest`, the address stored on the authenticated user record
takes precedence when present.

### Secrets handling

No credential is committed, and no `process.env.X || '<real-value>'` fallback pattern survives:
that idiom defeats environment configuration entirely, since the literal ships in the bundle no
matter how the environment is set. Consequences, by design:

- A missing variable **fails loudly** instead of silently binding to a previous project's
  infrastructure.
- `NEXT_PUBLIC_*` variables are compiled into client JavaScript and are treated as public;
  secrets live exclusively server-side.
- `firebase-messaging-sw.js`, a static asset served verbatim at a well-known path, receives its
  configuration as query parameters at registration time rather than carrying committed literals.

### Transport & request controls

| Control | Implementation |
|---|---|
| Security headers | `helmet` |
| Origin policy | `cors` pinned to `CLIENT_URL`, explicit method + header allowlist |
| Rate limiting | `express-rate-limit`, global window |
| Authentication | JWT bearer; user **re-fetched from the database on every request**, so revocation and `isBlocked` take effect immediately rather than at token expiry |
| Password storage | `bcrypt`; `password` excluded from queries via `.select('-password')` |
| Input validation | `express-validator` behind a shared `validateRequest` middleware |
| NoSQL injection | Regex metacharacters escaped before use in `$regex` search predicates |
| Auditability | `auditLogger` writes an `AuditLog` entry for privileged mutations |

---

## Type Safety

Both packages run TypeScript with `strict: true`, so `strictNullChecks`,
`noImplicitAny`, `strictFunctionTypes`, and `strictBindCallApply` are all active. The two
`tsconfig.json` files are otherwise tuned to genuinely different runtime targets rather than
being copies of one another:

| Option | `sft-server` | `sft-client` |
|---|---|---|
| `strict` | `true` | `true` |
| `target` | `es2016` | `ES2017` |
| `module` | `commonjs` | `esnext` |
| `moduleResolution` | node (default) | `bundler` |
| `outDir` / `rootDir` | `./dist` / `./src` | - (`noEmit: true`) |
| `jsx` | - | `react-jsx` |
| `isolatedModules` | - | `true` |
| `esModuleInterop` | `true` | `true` |
| `forceConsistentCasingInFileNames` | `true` | inherited via Next defaults |
| Path alias | - | `@/*` → `./*` |

The server emits real JavaScript to `dist/` and therefore owns `outDir`/`rootDir`; the client
delegates emit to the Next.js compiler (`noEmit: true`) and needs `isolatedModules` for
per-file transpilation. `forceConsistentCasingInFileNames` on the server matters specifically
because development happens on a case-insensitive filesystem while deployment targets a
case-sensitive one.

Domain types are expressed as Mongoose interfaces (`IUser`, `IInvestment`, `ITransaction`, …)
exported alongside their schemas, so controller code is checked against the persisted shape rather
than against `any`.

---

## Getting Started

### Prerequisites

- Node.js ≥ 20, npm ≥ 10
- A running MongoDB instance
- An EVM wallet extension for the client flows

### Install

Dependencies are managed through **npm workspaces** from the repository root:

```bash
git clone https://github.com/hakeemshah-tech/secure-financial-platform.git
cd secure-financial-platform
npm install
```

> A single unified `package-lock.json` at the repository root covers both workspaces. Do not add
> per-package lockfiles: npm workspaces ignores them, and Next.js will warn that it cannot infer the
> workspace root.

### Configure

```bash
cp .env.example sft-server/.env     # Section A
cp .env.example sft-client/.env     # Section B
```

Then populate each file with real values. `.env` is blocked recursively by the root `.gitignore`.

### Run

```bash
npm run dev            # client + server concurrently
npm run dev:server     # API only  - http://localhost:5000
npm run dev:client     # UI only   - http://localhost:3000
npm run seed           # create the bootstrap administrator
npm run build          # build both workspaces
```

---

## Tech Stack

**Client**: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Zustand ·
React Hook Form + Zod · ethers v6 · MetaMask + Stellar Freighter · Recharts · Framer Motion ·
Firebase Cloud Messaging

**Server**: Node.js · Express 5 · TypeScript (strict) · MongoDB + Mongoose 9 · JWT · bcrypt ·
helmet · express-rate-limit · express-validator · node-cron · Nodemailer · firebase-admin ·
stellar-sdk

---

## License

Proprietary. Copyright (c) 2026 Hakeem Shah. All rights reserved.

The source is published here for portfolio review and technical evaluation only. Viewing it does
not grant any right to use, copy, modify or distribute it. See [LICENSE](LICENSE) for the full
terms, and note that third-party dependencies remain under their own licenses.

---

## 🔐 Governance & NDA Compliance

This repository represents a sanitized, standalone snapshot of a production-grade enterprise application. 

To strictly comply with Non-Disclosure Agreements (NDA) and corporate security policies, the original Git history, proprietary business logic, client-specific configurations, and infrastructure-as-code (IaC) pipelines have been completely stripped from this public release. 

As a result, this repository is published as a single-commit snapshot for portfolio demonstration purposes. It highlights architectural decisions, component structure, state management, and API design patterns while protecting the intellectual property of the original stakeholders.
