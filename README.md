# Rankable

Rankable is a Discord Activity for building a shared media tier list. It is a
client-rendered React SPA served by the same Express process as its REST API and
WebSocket server.

## Requirements

- Node.js 24 LTS
- npm 11+
- Docker Desktop with Docker Compose
- A Discord development application with Activities enabled
- A Cloudflare-managed hostname and named tunnel for Discord testing
- A Supabase project with a private Storage bucket

## Local launch with the Discord mock

The mock mode exercises the full lobby and game without opening Discord. If
Supabase is not configured, it also supplies a small development-only media
catalog.

```sh
cp .env.example .env
npm install
npm run dev:local
```

Open two browser windows using the same `instance` but different users:

```text
http://localhost:3000/?instance=room-1&user=alex&username=Alex
http://localhost:3000/?instance=room-1&user=mina&username=Mina
```

Join both users, then use the first user's leader controls to start a round.
Closing or refreshing a joined window immediately removes that player, as
required by the game rules.

## Supabase media setup

1. Create a **private** Storage bucket, for example `rankable-media`.
2. Create one top-level folder per category.
3. Upload image files directly into those folders through the Supabase
   dashboard.
4. Put the project URL, server secret key, and bucket name in `.env`.

Example bucket:

```text
rankable-media/
├── anime/
│   ├── cowboy-bebop.webp
│   └── spirited-away.webp
└── tv-shows/
    ├── breaking-bad.webp
    └── severance.webp
```

Top-level folder names become category keys and labels. Filenames become card
titles. Only AVIF, GIF, JPEG, PNG, and WebP files are accepted.

The server scans and signs the entire catalog once when the first user opens a
new Discord Activity instance. That immutable snapshot is stored in PostgreSQL
and shared by all players in that instance. Bucket changes appear in the next
new Activity instance, not in one already running.

There are deliberately no upload routes, signed upload URLs, client-side
Supabase credentials, or file inputs. The Supabase service key remains on the
server.

## Discord application setup

1. Create a separate development application in the Discord Developer Portal.
2. Enable Activities and create its Entry Point command.
3. Copy the application/client ID, client secret, and bot token into `.env`.
4. Set both `DISCORD_CLIENT_ID` and `VITE_DISCORD_CLIENT_ID` to the application
   ID.
5. Set `VITE_DISCORD_MOCK=false`.
6. Configure the Activity URL mapping `/` to the stable Cloudflare hostname.

The Activity requests only the `identify` OAuth scope. `DiscordSDK` runs only in
the React client. Express performs code exchange, user lookup, Activity-instance
verification, and opaque application-session creation.

## Stable Cloudflare tunnel

Install and authenticate `cloudflared`, then create a named tunnel and DNS
route. Keep its generated credentials outside this repository.

```sh
cloudflared tunnel login
cloudflared tunnel create rankable-development
cloudflared tunnel route dns rankable-development rankable-dev.example.com
cp cloudflared.example.yml cloudflared.yml
```

Edit `cloudflared.yml` with the real hostname and absolute credential-file
path. Set the same hostname in `.env` as `PUBLIC_HOSTNAME`.

## Full Discord development launch

With Docker Desktop running, Supabase configured, `cloudflared.yml` present,
and Discord configured:

```sh
npm install
npm run dev
```

That command:

1. Starts PostgreSQL through Docker Compose and waits for readiness.
2. Applies committed Prisma migrations.
3. Runs Express and Vite middleware under a TypeScript watcher.
4. Runs the named Cloudflare tunnel alongside the application.

The single Express port owns:

- `/api/*` — REST API
- `/ws` — authenticated game synchronization
- `/__vite_hmr` — Vite development HMR
- `/health/live` — process liveness
- `/health/ready` — PostgreSQL readiness
- all remaining GET routes — React SPA

## Verification

```sh
npm run typecheck
npm test
npm run build
```

Or run all three:

```sh
npm run check
```

## Production-style launch

Set `NODE_ENV=production` and `VITE_DISCORD_MOCK=false`, provide all production
environment variables, then run:

```sh
npm ci
npm run db:deploy
npm run build
npm start
```

The production server serves hashed Vite assets with immutable caching and
serves `index.html` without caching so deep SPA routes continue to work.
