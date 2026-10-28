# PropIQ — NBA Player Prop Research

PropIQ's current mobile-first interface, synced from the active [Vercel deployment](https://propiq-nba.vercel.app/) on October 28, 2026.

## Included

The frontend source contains the Today/Tomorrow slate switch, Smart Filters and presets, saved research views, historical research grades, local line-watch snapshots, player Performance Lab (L3/L5/L10/L20), sportsbook line comparison, `Why This Prop?`, defensive-rank explanations, and the recent fixes for empty slates and provider failures.

## Important: backend functions are not yet included

This folder is a **frontend source snapshot, not a self-contained deployable copy**. The running Vercel project has the following serverless API routes, whose complete source was not available to export via the connected deployment tools:

- `api/board.js`
- `api/compare.js`
- `api/data.js`
- `api/defense-evidence.js`
- `api/dvp.js`
- `api/insight.js`
- `api/splits.js`

Those functions continue to run on the existing Vercel project. To create an independently deployable repository, add the full handlers from your original backend source and verify their data-provider terms. Do **not** replace the production handlers with placeholder implementations.

The frontend calls relative `/api/*` endpoints and therefore cannot provide working live props by itself.

## Access & security

The live site is protected by Vercel Authentication and its API credentials are configured in Vercel environment settings. **No secrets, `.env` files, or API keys are included in this GitHub folder.** The parent repository is public, so never commit credentials or private account information.

The research scores and historical hit rates describe past outcomes; they are not guaranteed predictions.

## Current live app

[PropIQ on Vercel](https://propiq-nba.vercel.app/)

This folder is separate from `hoopiq/`, which remains untouched.
