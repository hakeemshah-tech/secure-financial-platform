# Secure Financial Platform - Client

Next.js 16 (App Router) frontend for the Secure Financial Platform monorepo.

This package is not intended to be installed or run on its own. Dependencies are managed
through npm workspaces from the repository root, and the client requires the API in
`sft-server/` to be running.

See the [root README](../README.md) for the full architecture overview, security posture,
configuration reference and setup instructions.

```bash
# from the repository root
npm install
npm run dev:client
```
