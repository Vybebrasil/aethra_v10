# UI Stability Pass

## Critical problems found

1. The enemy card was rendered into the 30 px versus column because an older compact rule hid the VS element while CSS Grid still reserved its column.
2. Combat cards had a forced minimum height of 226 px inside an arena of roughly 185 px at 1366×768.
3. The skill bar generated around 129 px of content inside a 104 px visible region.
4. The exploration panel rendered current activity, three large summary cards, event history, and counters inside the same limited height.
5. Loot, progression, and Hunt Analyzer competed for fixed right-column space without reliable internal scrolling.
6. Hero accordion sections retained old height constraints and the sidebar used hidden overflow.
7. The Hunt catalog switched to a single-column layout at 1400 px, pushing creature details below the visible modal area.
8. The drop preview was a shrinkable flex child and could collapse to zero height.
9. Inventory opened at 430 px although its content requires a two-column backpack/paperdoll layout.
10. Skills could be positioned below the viewport because the window was measured before its final content height was rendered.
11. Navigation tooltips could remain visible after changing screens.
12. Targeted Hunts still used the label “Loot da Expedição”.

## Applied corrections

- Added `style-stability.css` as the final CSS authority.
- Added `UIStabilityPass.js` as the final UI lifecycle pass.
- Locked the main UI to the viewport and reserved 184 px for the ActionBar.
- Established fluid left, center, and right columns with explicit minimums.
- Assigned hero, VS/event marker, and contextual card to explicit grid columns.
- Removed the floating turn banner that covered portraits and resource bars.
- Simplified the exploration panel into current activity, event timeline, and counters.
- Added internal scrolling to long hero, loot, progression, analyzer, and modal content.
- Expanded Inventory to a 780 px two-column client.
- Clamped floating windows after rendering.
- Preserved the Atlas of Hunts as a two-column catalog and made the drop preview scrollable.
- Made the Hunt start button sticky inside the creature detail panel.
- Contextualized the loot title between Hunt and Expedition.
- Closed active tooltips on navigation and window actions.

## Validation matrix

- 1366×768: idle, active combat, contextual event, Inventory, Skills, Inspect, City, Expedition map, Hunt atlas.
- 1728×900: active combat and full dashboard.
- Hero section collapse and full-panel minimize.
- ActionBar priority reorder.
- Targeted Hunt creation with a single 100-weight creature pool.
- All tested floating windows remained inside the viewport.
- No horizontal or vertical page scroll.
- No JavaScript console or page errors in the automated interface audit.
