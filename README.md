# Sell Similar

pnpm workspace managed by Turborepo. Applications are independently deployable; shared runtime contracts live in `packages/` so request, job, and listing schemas cannot drift between apps.

Apps must not import source files from sibling apps. Share code only through `packages/`.

## Workspace commands

```bash
pnpm install
cp .env.example .env

pnpm dev     # start development tasks (apps + package watchers)
pnpm build   # build all deployable apps (and the packages they depend on)
pnpm check-types
pnpm clean
```

Build or develop a single app:

```bash
pnpm --filter @sell-similar/api dev
pnpm --filter @sell-similar/extension build
```

## Layout

```
apps/
  extension/        WXT + React + TypeScript, Manifest V3
  api/              Express API + Better Auth
  scraper-worker/   Redis queue consumer + Puppeteer
  cron/             Agenda recurring/scheduled jobs
packages/
  contracts/        shared request/response/job/listing types
  validation/       Zod schemas shared by API, worker, and extension
  ebay-models/      normalized listing + fitment models
  api-client/       typed extension API client
  config/           environment/config helpers
  logging/          structured logger + correlation IDs
  tsconfig/         shared TypeScript configuration
```
