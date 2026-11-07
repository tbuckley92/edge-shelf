# Edge Shelf

Standalone Edge Sculpture collector app for Netlify and Supabase.

## Development

Requires Node.js 22 or later.

```sh
npm ci
npm test
npm run dev
```

Tests and builds prepare transparent product images from the catalogue's Shopify CDN sources. This happens before serving the app, never during scrolling. Generated cut-outs are excluded from Git; the logo and shelf textures are committed. The first build requires access to those image sources and fails if preparation is incomplete.

The local `/__qa` route opens a labelled UI fixture. It is not part of the deployed API.

## Netlify

Import this repository and deploy `main`. Configuration is in `netlify.toml`:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

Set server environment variables from `.env.example`. Register the exact `/api/auth/callback` URL with Shopify Customer Account API. Login remains unavailable until the OAuth client and database connection are configured. Never put secrets in Git or client JavaScript.

For a new database, apply SQL migrations using the migration owner and run `node scripts/seed-catalog.mjs` with a secure `MIGRATION_DATABASE_URL` after image preparation. Runtime must use a separate restricted database login that is a member of `shelf_backend`, never the migration owner. Do not reapply migrations blindly to an existing configured database.

## Current scope

Shopify OAuth/session backend, private collection persistence, unique owned copies, stable shelf settings, product search and physically scaled shelf rendering. Payments, public sharing, wishlist UI and temporary try-on UI are not implemented.

Automated tests cover identity verification, PostgreSQL isolation, persistence and packing. Live Shopify login, cross-device acceptance and real mobile drag QA remain release gates.
