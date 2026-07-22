# AGENTS.md

This file defines the development rules for Codex in this repository.
It applies to the entire repository unless a more specific `AGENTS.md` exists in a subdirectory.

## Project Overview

SpotSave is a React + Vite + Firebase application for saving and managing places found on services such as TikTok, Instagram, and YouTube.

- Manage places with URL, shop/place name, address, category, and image data.
- Persist application data with Firebase Firestore.
- Use React Router for page navigation.
- Use Leaflet for map display.

## Roles

- ChatGPT is responsible for planning, product/spec discussion, design review, and code review.
- Codex is responsible for implementation, file edits, linting, builds, and tests.
- When requirements are unclear, confirm the intended behavior before making broad changes.

## Autonomous Work Allowed

Codex may run the following without prior confirmation when they are directly related to the task:

- Read project files and inspect Git status/diffs.
- Edit normal source, documentation, and configuration files within the requested scope.
- Run formatting or lint commands already used by the project.
- Run `npm run lint`.
- Run `npm run build`.
- Run existing relevant tests when available.
- Review `git diff` after changes.

## Confirmation Required

Ask for confirmation before doing any of the following:

- Creating, editing, displaying, logging, or deleting `.env`, `.env.local`, `.env.production`, or other secret-bearing files.
- Changing Firebase production settings, Firebase project configuration, Firestore rules, hosting settings, or deployment settings.
- Changing billing, pricing, paid plans, quotas, or subscription-related settings.
- Running destructive Git operations such as `git reset`, `git clean`, force push, deleting branches, or overwriting user work.
- Installing new dependencies unless the task clearly requires it and the reason has been explained.
- Making broad refactors that are not necessary for the requested change.

## Secret And Environment Rules

- Keep Firebase settings in `.env.local`.
- Do not commit `.env.local`.
- Use the `VITE_` prefix for Vite environment variables.
- Do not hard-code secrets or API keys in source code.
- Do not display, print, paste, log, or expose API keys or secret values.
- If a secret value is needed for local verification, ask the user to configure it locally without revealing it.

## Development Rules

- Understand the existing component and directory structure before editing.
- Identify the root cause before applying a fix.
- Keep changes as small and focused as possible.
- Match existing React, Vite, Firebase, routing, and styling patterns.
- Keep dependencies to the minimum necessary.
- Do not change production code, Firebase settings, environment variables, or pricing/billing unless explicitly requested and confirmed.

## Main Directories

- `src/components/`: Reusable UI components.
- `src/pages/`: Page-level components.
- `src/services/`: Firebase and external API integrations.
- `src/firebase.js`: Firebase initialization.

## Verification

After making changes, Codex should perform the relevant checks for the task:

- Run `npm run lint` when code or lintable files changed.
- Run `npm run build` when application code or build-related configuration changed.
- Run related existing tests when available.
- Inspect `git diff` and self-review the changes before reporting.

For documentation-only changes, lint/build/tests may be skipped if they do not provide meaningful coverage; still inspect `git diff`.

## Preview Deployments

- Always verify preview builds through the fixed alias `spot-save-app-review.vercel.app`, not the random per-deploy Vercel URL (`spot-save-xxxxx-...vercel.app`).
- After creating a new preview deployment, repoint the alias to it: `vercel alias set <new-deployment-url> spot-save-app-review.vercel.app`.
- Firebase Authentication's Authorized domains list already includes `spot-save-app-review.vercel.app`. Random per-deploy preview URLs are not authorized and will fail Google sign-in with `auth/unauthorized-domain`.

## Final Report Format

Final reports should be concise and include:

- Summary of what changed.
- Files changed.
- Verification performed, including commands run or clearly stating when checks were skipped and why.
- Any risks, follow-up items, or items that were intentionally not changed.

