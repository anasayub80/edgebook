# Edgebook

Interactive trading-journal UI/UX preview, designed for manual trading and MT5 Expert Advisors.

## Explore

- Performance overview with account, source, and period filters
- Searchable, filterable, paginated trade history and CSV export
- Trade review drawer with execution levels, notes, emotion, quality score, tags, and screenshots
- Monthly trading calendar with daily drilldowns and monthly review reports
- Performance, session, instrument, strategy, and behavior analytics
- Multi-account closed-trade equity and drawdown tracking
- Editable strategy playbooks and risk rules
- Psychology journal, mood check-ins, and process habits
- Position sizing and drawdown recovery calculator
- MT5 connection onboarding drafts, validated CSV import, and workspace backups
- Profile, timezone, notification preferences, and data management

## Scope

This is a frontend design preview. The 219 initial trades and three accounts are illustrative, dated July 20–October 16, 2026. UI changes persist in browser localStorage. No broker connection, order execution, backend authentication, server-side storage, live floating equity, or risk enforcement is implemented. No broker passwords are requested.

MT5 integration should use a secure, read-only bridge and normalize broker deals into the trade schema. The next phase should add user access, encrypted server-side integration secrets, broker imports and deduplication, cash-flow-adjusted equity, live floating P&L, timezone/DST-aware session templates, and enforced privacy boundaries between users.

## Source

Buildless ES modules, semantic HTML, custom CSS, and SVG charts. No JavaScript runtime dependencies.

- `dist/app.js`: state, persistence, imports/exports, forms, dialogs, event handling
- `dist/views.js`: the ten workspace screens
- `dist/data.js`: deterministic sample data, metrics, and aggregation helpers
- `dist/ui.js`: reusable controls, charts, tables, and formatting
- `dist/styles.css`: responsive visual system and reduced-motion support
- `dist/index.html`: application entry point

Hosting configuration: `.openai/hosting.json` serves `dist`.

## Validation

JavaScript syntax checks pass. Programmatic QA rendered 57 account/filter/screen variations and verified trade creation, metric propagation, review saving, journal habits, setup creation, risk-rule validation, connection drafts, CSV parsing, backups, and persistence. Markup checks covered labels, unique IDs, forms, and all action handlers across 25 screen/dialog renderings. Browser visual QA was unavailable in the execution environment.
