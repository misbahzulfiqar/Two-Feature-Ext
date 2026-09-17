# Sell Similar

pnpm workspace managed by Turborepo. Applications are independently deployable; shared runtime contracts live in `packages/` so request, job, and listing schemas cannot drift between apps.

Apps must not import source files from sibling apps. Share code only through `packages/`.

The public product flow is: sign up on the website → install from the Chrome Web Store → return to the site so it can detect and pair the extension → use the panel inside eBay’s listing editor.

After Chrome publishes the listing, set `VITE_CHROME_WEBSTORE_URL` in `apps/web/.env.local` to the store page that includes `/detail/` (the 32-character ID is read from that URL). Then restart the website. Install buttons never open the empty Chrome Web Store homepage.

Scrape progress is short-interval HTTP polling (`GET /listings/scrape/progress` → worker `GET /scrape/progress`) while the blocking `POST /listings/scrape` is in flight. The MVP does not require a persistent WebSocket for that. WXT `ws://127.0.0.1:3010` is local HMR only.

## Workspace commands

```bash
pnpm install
cp .env.example .env

pnpm dev     # start development tasks (apps + package watchers)
pnpm build   # build all deployable apps (and the packages they depend on)
pnpm check-types
pnpm clean
```

One API on port 3001 is shared by the website, admin panel, and extension. Start it once, then start only the frontends you need:

```bash
pnpm --filter @sell-similar/api dev
pnpm --filter @sell-similar/web dev
pnpm --filter @sell-similar/admin dev
pnpm --filter @sell-similar/extension build
pnpm --filter @sell-similar/extension zip   # Chrome Web Store package
```

API: `http://127.0.0.1:3001` (one process for the whole project)  
Website: `http://127.0.0.1:3004`  
Admin: `http://127.0.0.1:3005`

## Layout

```
apps/
  extension/        WXT + React + TypeScript, Manifest V3
  api/              Express API + Better Auth
  scraper-worker/   Redis queue consumer + Puppeteer
  cron/             Agenda recurring/scheduled jobs
  web/              Marketing + account site (Vite + React)
  admin/            Admin panel (Vite + React)
packages/
  contracts/        shared request/response/job/listing types
  validation/       Zod schemas shared by API, worker, and extension
  ebay-models/      normalized listing + fitment models
  api-client/       typed extension API client
  config/           environment/config helpers
  logging/          structured logger + correlation IDs
  tsconfig/         shared TypeScript configuration
```
