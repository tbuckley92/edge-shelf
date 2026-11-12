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

Shopify OAuth/session backend, private collection persistence, unique owned copies, stable shelf settings, product search and physically scaled shelf rendering. Collector profiles support field-level public visibility, owned-copy levels, colour avatars, a collection summary, official employee badges and an administrator audit view. Payments, wishlist UI and temporary try-on UI are not implemented.

## Collector profiles

Apply `supabase/migrations/20261112073058_collector_profiles.sql` after the existing migrations, before deploying the profile release. This is additive and preserves existing collections. The schema stays private, with no grants to Supabase browser roles. Each owned row is one copy and contributes one level, including duplicates and copies removed from the display. The shelf `order` is a subset of owned IDs. No automatic permanent achievement rules are activated yet.

`/profile.html` edits the signed-in collector. `/profile.html?collector=<id>` reads a strict public projection; private profiles return 404 and contact fields never leave this endpoint. Public sharing defaults off. Publishing a collection inherently reveals its quantities even when the level badge is hidden.

First/last names are updated through Shopify's Customer Account API. Email changes use Shopify's hosted `/account/profile` flow; signing in again refreshes the verified address. Phone is explicitly Shelf-only in this release. No Klaviyo sync is newly installed and no profile edit subscribes a user to marketing. Existing sessions must sign in again to load contact details and enable name updates. Access tokens are AES-GCM encrypted using a key derived from the high-entropy HttpOnly session cookie, expire with the session, and are never returned to the browser. No refresh token is retained.

Admin privileges are explicitly provisioned in `shelf.admin_roles` by the database operator after confirming the user's Shopify identity. No first-user or email-based auto-admin rule exists. Grant `role='admin'` to the verified profile UUID; database changes are audited. An official employee badge does not confer privileges. The admin page lists up to 100 collectors and 100 recent events. Badge grant/revoke actions require a reason. Contact audit events record changed field names rather than retaining historic personal values; ownership/badge events preserve before/after values. Audit rows are append-only to the runtime role. A future retention/deletion policy must cover this table as well as profiles.

Versioned `plan_versions` and `plan_benefits` are present with Free only. Subscription billing, paid-item fulfilment, three-day grace periods and premium expiry conversion remain later work; this release does not charge or lock existing effects.

Automated tests cover identity verification, PostgreSQL isolation, persistence, packing, private/public profile projection, forged privilege rejection, badge grants/revocation, audit immutability, session-bound encryption and off-shelf ownership. Local UI fixture checks do not prove Shopify mutations or Klaviyo propagation; live name/email changes and real mobile interaction need separate acceptance checks.

## Profile pictures and navigation
Apply `supabase/migrations/20261112075814_profile_avatars_privacy.sql` before this release. Existing profiles keep first/last names hidden. Switching public sharing on in the editor selects every visibility option; collectors can deselect individual fields before saving. Colour and picture accompany public profiles; email and phone remain private.

Profile pictures use locally hosted Twemoji animal presets (CC BY 4.0, attribution included) or uploaded JPG/PNG/WebP. The browser resizes uploads; the server independently validates and re-encodes to 384px WebP with a 150KB storage cap. One image per owner is held in an RLS-protected table, and public access follows profile visibility. Originals and image bytes are excluded from audit logs.

The shelf header has a left logo, navigation menu, centred avatar/level/badges and plus-button catalogue entry. `/api/bootstrap` combines account and collection loading. Profile and collection reads each use one aggregate query; catalogue loading is deferred on the profile page, static catalogue data has short caching, and image processing imports only for uploads. Server-Timing measures application request duration. These reduce repeated work; hosting cold starts and database/network latency may still affect first loads.

## Named displays and floating rocks
Apply `supabase/migrations/20261112083300_collection_status_frames.sql` and `supabase/migrations/20261112091800_named_displays.sql` before deployment. Existing layouts, rows, uploaded backgrounds and placements are preserved. The root page is the My displays library. Each named display is a cabinet or a floating-rock presentation. Frames (Classic, Black, Temple, Rock, Ice) are independent of row finishes.

All collection statuses can appear on any display. Changing status preserves placements; removing a placement preserves inventory. Only current copies count towards level, once each regardless of display reuse. Arrangement saves cannot change inventory. Inventory management and display mutations use owner locks and revisions; stale saves are rejected. Older clients must reload.

Email preferences remain in Profile with no new mailing-list integration. My collection is directly accessible in the menu. See `docs/collector-displays.md` for the data model and prototype limitations.

## Rock platform themes and groups
Apply `supabase/migrations/20261112095223_rock_platforms.sql` before deployment. Existing displays receive an empty config and still resolve to one moss rock per displayed copy. Rock settings save under the existing owner lock, optimistic revision and audit rules. Sizes allow up to 3 pieces with separate foreground layers. The public demo allows temporary editing without account writes. No billing or privacy changes.
