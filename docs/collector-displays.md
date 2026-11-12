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
Original transparent island artwork supports front-facing sculpture cutouts. An elliptical ring uses depth-dependent scale, opacity and stacking. Drag/swipe, focused scroll wheel, arrows and keyboard rotate it. A grid view and reduced-motion support provide alternatives. At most seven island nodes render at once; larger collections rotate through the visible window. Animation sleeps when settled or the page is hidden. No image/video API runs when visitors use it.

This is 2.5D, not a true 3D sculpture model. Rock sculptures scale to the presentation slot rather than the cabinet's physical metre scale. Rocks support Moss, Waterfall, Ice and Lava styles; small/medium/large sizes hold one/two/three copies. Per-rock foregrounds include shrubs, stones and ice crystals. The rock, contact shadows, sculptures and foreground are separate depth layers that bob together. Motion respects reduced-motion and can be paused; it also pauses offscreen or in a hidden tab. Rock settings persist in owner-scoped layouts.rock_config; placement membership remains authoritative. Moving a copy between platforms never changes inventory; shrinking a platform gives released copies their own platforms. Empty platforms can be removed. Pillars, public display links and display deletion/archive are not implemented. Displays remain owner-only; existing public-profile privacy controls are unchanged.

## Validation
Automated PostgreSQL tests cover multi-display reuse, status preservation, targeted removal, oversized rock pieces, owner isolation, stale edits, and unchanged level. Browser fixture tests exercise real server helpers on PGlite with simulated data, not production customer records.

## Asset provenance
`dist/assets/floating-rock-v1.webp` was generated with imagegen on 2026-11-12, then resized to 720px WebP. Prompt: a single photorealistic floating island pedestal with broad flat empty moss-and-stone top, inverted tapering crag, hanging roots, viewed slightly from above; isolated transparent background; no sculpture, trees, sky or lettering. Original output: `generated_images/exec-9b6a87c0-49d7-46b4-9ac2-28c7c2ecc9c9.png`. Sculpture cutouts are existing catalogue assets, not generated.

## Theme asset provenance (2026-11-12)
Built-in imagegen edits of the original transparent island created `dist/assets/floating-rock-waterfall-v1.webp`, `dist/assets/floating-rock-ice-v1.webp` and `dist/assets/floating-rock-lava-v1.webp`, resized to 900px WebP with alpha preserved. Shared prompt: preserve camera, silhouette proportions, broad elliptical flat empty top and tapering inverted mountain; premium photorealistic fantasy terrain, transparent background, no sculptures/animals/people/text/sky/floor. Variants: moss, rear turquoise pool and left-edge waterfall; pale-blue crystalline ice, frosted slate and hanging icicles; dry dark basalt with orange fissures and right-edge lava rivulet. Existing transparent grass, volcanic-stone and ice foreground assets provide the front scenery layer. No customer sculpture image was generated or edited.

## Helix presentation (supersedes grouping UI)
Rocks now follow a finite vertical helix driven by a native scroll surface. Up/down scrolling translates the chain and rotates each platform through depth; rear rocks become smaller and fainter. Only nearby platforms render. Grid, arrow buttons, Page Up/Down, Home/End remain available. Tapping any sculpture opens the same styled product drawer as cabinets, including image, dimensions, collection status, product link and targeted removal.

Every rock now holds one piece. Legacy multi-piece configs are split on read by the shared resolver, retaining every placed copy and its original style/foreground; next settings save persists the split. No inventory or placements are deleted. New multi-piece settings writes are rejected. Foreground strips have been replaced by small alpha-textured clusters positioned along the curved front rim, with the centre lower than the sides. No new generated assets.

### Rock atmosphere
Each rock display saves validated fog enablement, density, speed, hex colour and background choice in layouts.atmosphere. Updates use owner scoping, the display revision and audit events. The demo previews settings without persisting them. Cancel reverts unsaved previews. Depth haze sits behind platforms; continuous opacity, desaturation and slight blur dissolve receding platforms into it without any hard fog-plane crossing. A separate translucent foreground layer at z150 drifts across the screen, including the active sculpture, using the same colour, density, speed and pause controls. Fog is pointer-transparent. The generated floating-mountain background pans vertically with scroll progress; reduced motion disables fog animation and parallax, and pause/offscreen handling suspends fog drift.

Background asset: dist/assets/floating-mountains-v1.webp, generated with the built-in image tool. Prompt: cinematic portrait fantasy floating limestone mountains, forests, waterfalls and layered teal mist, large edge mountains and calm central sky, no characters, text or sculptures.
