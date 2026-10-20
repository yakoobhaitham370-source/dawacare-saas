# DawaCare

A pharmacy patient, medication and refill workspace for Iraq, built with React, strict TypeScript, Fluent UI v9, Supabase and Netlify.

**Development release. Not production-ready.** The synthetic workspace works locally without accounts. Hosted authentication, email invitations, private storage, live AI and deployment still require configuration and verification. Never enter real patient information into the sandbox.

## Run locally

1. Install Node.js 24 LTS (22.12+ is the minimum).
2. In this repository, run `npm ci --cache /workspace/.npm-cache` in the cloud workspace, or `npm ci` on your own computer.
3. Run `npm run dev`.
4. Open the application using your local development tooling and choose **Explore synthetic sandbox**. No account is needed. Synthetic records persist in this browser under `dawacare.synthetic.v1`; delete that one storage key to reset them.
5. Register a patient, add a verified medicine, record dispensing, and open the refill queue. The header's **Test role** control exists only in the sandbox.

The connected application starts from **Sign in**. It never substitutes synthetic data if Supabase fails.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Cloud browser tests use the installed `/usr/bin/chromium`. On another machine set `PLAYWRIGHT_CHROMIUM_PATH` to a Chromium executable, or install Playwright Chromium and adapt the configuration. See [testing evidence](docs/TESTING.md).

## Connect and deploy

Follow the numbered [owner manual](docs/OWNER_MANUAL.md), then [deployment guide](docs/DEPLOYMENT.md). Do not paste service keys into chat or commit `.env` files. `.env.example` contains names only.

- [Architecture and trust boundaries](docs/ARCHITECTURE.md)
- [Database and migration instructions](docs/DATABASE.md)
- [Permissions](docs/PERMISSIONS.md)
- [Security and release gates](docs/SECURITY.md)
- [AI integration and limitations](docs/AI_INTEGRATION.md)
- [Pharmacy workflow manual](docs/PHARMACY_MANUAL.md)
- [Roadmap and known gaps](docs/PRODUCT_ROADMAP.md)
- [Machine-readable implementation evidence](docs/implementation.json)
- [Complete founder specification](docs/MASTER_SPECIFICATION.md)

No deployment, production migration, commercial compliance certification, or live provider success is implied by a local build.
