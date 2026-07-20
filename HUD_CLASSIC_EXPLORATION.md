# HUD Classic Exploration Pass

## Hero panel

- Removed the tab-only navigation model.
- Added a vertically scrollable classic MMO panel.
- Overview, attributes, equipment, backpack and skills are stacked as collapsible sections.
- Collapse state is remembered in localStorage.
- Added expand/collapse-all control.

## Encounter and exploration

- Reduced encounter card footprint.
- Added an expedition route with visible stages.
- Added a live world-reading panel.
- Added expedition diary entries for combat, resources, discoveries and skill progression.
- Exploration events can surface as contextual actions.

## ActionBar

- Filled slots can be dragged and dropped.
- Dropping a skill onto another filled slot swaps their priority positions.
- The visual order stays synchronized with SkillSystem priorities.
- Added drag handles and drop feedback.

## Combat feedback

- Damage and healing numbers are attached to the corresponding combat portrait.
- Removed global floating damage from the top-left of the viewport.

## Hunt Analyzer

- Added automatic live telemetry for XP/h, profit/h, kills, DPS, damage caused/taken and criticals.
- Added loot, gold, skill XP, resources, costs and rare-event counters.
- Analyzer refreshes while the session is active.
