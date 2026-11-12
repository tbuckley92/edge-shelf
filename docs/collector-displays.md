# Collector displays and Edge Rocks

## Shipped in this iteration
- Email preference is edited in Profile. It is still a Shelf-only preference; no Klaviyo/Shopify consent propagation is claimed.
- Collection management shows individual copies, status, and each placement. Removing a placement preserves the copy and level. Changing to previously owned or wishlist removes placements and excludes the copy from current level calculations. Moving back to current does not restore old placements automatically.
- Classic, Obsidian Black and Temple Stone style the outer display frame independently of each row's finish, lights, weather and background.
- Bronze/opal avatar rim and enamel level badge use original styling, without assigning new rank thresholds or premium status.

## Next implementation: multiple named displays
The existing `layouts` table already supports multiple owner/name pairs; the client and `readState` currently select `My shelves`. Do not turn on display creation before fixing the global collection replacement semantics in `writeState`.

| Entity | Responsibility |
| --- | --- |
| Profile | Identity, privacy, avatar, preferences and badges |
| Collection copy (`owned_items`) | Product ID, current/previous/wishlist status; duplicates have independent copy IDs |
| Display (`layouts`) | Owner, name, frame theme, presentation mode, revision, per-display visibility |
| Shelf row (`shelves`) | Display ID, position, finish, lights, weather, background and grouping hints |
| Placement (`placements`) | Copy ID, display ID, row/rock slot, position |
| Theme definition | Stable theme key, asset version and optional entitlement feature |

A collector could create Living Room, Bears, and Dream Collection. Each display has several rows. The same current copy may appear in different alternative displays, once per display. It counts towards the collector level once. Two physical copies remain two separate collection records.

Implementation order:
1. Add display create/rename/archive/select endpoints. Keep owner RLS and immutable owner IDs. Migrate the current layout in place rather than copying it.
2. Split inventory actions from layout saves: a layout save must never delete global collection records or placements in another display. Current `writeState` replaces global owned items, so simply adding a selector is unsafe.
3. Add profile `collection_revision` for inventory concurrency; retain individual layout revisions for arrangement/theme edits. Validate cross-owner and stale-display writes transactionally.
4. Add a display switcher, per-display settings and theme catalogue. Store frame/theme independently from row finish. Preserve row/background IDs during switches.
5. Profile manager already accepts multiple location chips; link each chip to its display and row, add placement picker, and archive displays without deleting inventory.
6. Add display visibility subordinate to profile privacy. A private profile always wins. Wishlists and history remain private unless separate controls are explicitly introduced.
7. Test creating a second display, reusing a copy without double-counting, changing status across both displays, removing only one placement, switching without lost edits, and archiving while preserving collection.

## Edge Rocks: alternate presentation mode
Each rock is a display slot carrying one sculpture or a small group. Rocks orbit an elliptical ring in perspective: front rocks are larger, brighter and lower; rear rocks are smaller, higher and fainter. The sculptures remain front-facing cutouts, avoiding the paper-thin look of rotating a flat product image. Rock assets can have separate front/back silhouettes, contact shadows, moss and restrained mist.

Interaction: drag/swipe left or right, arrow keys and previous/next buttons. Wheel interaction only while the carousel is deliberately engaged; normal page scrolling remains available. Snap the selected rock to the front, with its name and a details button. Behind-ring elements are not separately focusable; keyboard controls select the same pieces. Respect reduced motion and offer a flat grid alternative.

Rendering: browser JavaScript plus CSS transforms or a canvas scene. A 2.5D first version uses transparent rock and sculpture images, depth-derived scale/opacity, z-ordering and shadows. It needs no generation API per visit. True 3D rock models could be introduced with WebGL later; the existing sculpture cutouts are not 3D models and cannot reveal unseen sides.

Performance: render only 7–9 nearby rocks, lazy-load other pieces, cap image resolution, update transforms only during interaction/settling, and pause all effects when hidden. Paginate a large collection rather than putting hundreds of moving layers into one orbit. Keep photo/background uploads out of the first version.

The same placements should drive shelf and rock modes. Use a presentation adapter rather than a second collection. Store selected mode and rock theme on the display; preserve shelf arrangement when switching. This requires display-specific placement metadata for each mode so changing the ring order does not overwrite shelf rows.

Acceptance: readable foreground pieces, believable contact shadows, no clicks through rear rocks, touch and keyboard support, no wheel trapping, reduced-motion mode, smooth performance on a mid-range phone, and mode switches that preserve all collection and placement data.
