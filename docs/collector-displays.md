# Named displays and floating rocks

## Shipped
My displays is the library of up to 50 named displays. Add a cabinet or floating-rock display, optionally populated with all current, previous, wishlist, or all copies. Existing cabinets are migrated in place. Cabinets have a frame theme independent of each row's finish, lighting, weather and uploaded background. Displays can be renamed. The menu links directly to My collection.

Collection copies and display placements are separate. Any status can be placed on any display, once per display. Copies can appear across several displays without increasing level. Status changes retain placements. Only current copies contribute to level. Placement icons are ✓ current, ↶ previous, ♡ wishlist. Removing a placement never deletes inventory.

| Entity | Responsibility |
| --- | --- |
| Profile | Identity, privacy, avatar, badges, collection revision |
| Collection copy | Product, current/previous/wishlist status; independent copy IDs |
| Display | Owner, name, cabinet/rocks type, frame, default row finish, revision |
| Shelf row | Display, order, finish, effects, background and grouping |
| Placement | Copy, display, optional row, position |

The picker offers collection search, status filters, bulk additions, and the full catalogue. Catalogue additions create an explicit new copy with a chosen status (default wishlist). A display save modifies arrangements only; it cannot replace inventory. Owner locks, RLS, layout revisions and collection revisions protect cross-account access and stale writes. Display mutations are audited.

## Floating-rock prototype
Original transparent island artwork supports front-facing sculpture cutouts. An elliptical ring uses depth-dependent scale, opacity and stacking. Drag/swipe, focused scroll wheel, arrows and keyboard rotate it. A grid view and reduced-motion support provide alternatives. At most nine island nodes render at once; larger collections rotate through the visible window. Animation sleeps when settled or the page is hidden. No image/video API runs when visitors use it.

This is 2.5D, not a true 3D sculpture model. Rock sculptures scale to the presentation slot rather than the cabinet's physical metre scale. One sculpture sits on each rock. Pillars, editable rock themes, public display links and display deletion/archive are not implemented. Displays remain owner-only; existing public-profile privacy controls are unchanged.

## Validation
Automated PostgreSQL tests cover multi-display reuse, status preservation, targeted removal, oversized rock pieces, owner isolation, stale edits, and unchanged level. Browser fixture tests exercise real server helpers on PGlite with simulated data, not production customer records.

## Asset provenance
`dist/assets/floating-rock-v1.webp` was generated with imagegen on 2026-11-12, then resized to 720px WebP. Prompt: a single photorealistic floating island pedestal with broad flat empty moss-and-stone top, inverted tapering crag, hanging roots, viewed slightly from above; isolated transparent background; no sculpture, trees, sky or lettering. Original output: `generated_images/exec-9b6a87c0-49d7-46b4-9ac2-28c7c2ecc9c9.png`. Sculpture cutouts are existing catalogue assets, not generated.
