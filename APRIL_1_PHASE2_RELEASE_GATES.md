# April 1 Phase 2 Release Gates

## Gate List (highest risk first)

| ID | Blocker | Reproduction steps | Affected role(s) | Affected route(s) | Root cause hypothesis | Code area implicated | Fix owner | Status | Re-test result | Remains demo blocker? |
|---|---|---|---|---|---|---|---|---|---|---|
| RG-1 | Post-login landing goes to `/` instead of role home | Sign in as nurse or doctor on live prod | nurse, doctor | `/sign-in` -> `/` | client redirect trusts `user_metadata.role` and uses SPA navigation instead of server-verified session/DB role | `app/(auth)/sign-in/sign-in-form.tsx` | Agent | **fixed in repo / pending redeploy** | live prod still fails; repo fix not yet deployed | **Yes** on current prod |
| RG-2 | Client navigation dead on hydrated workflow screens | nurse: patient chart `Visit History`; visit history `Log New Visit`; doctor: `Open Notes` -> `Continue Note` | nurse, doctor | `/patients`, `/patients/[id]/visit-history`, `/open-notes` | hydration mismatch (`React error #418`) likely from client-side date formatting text mismatch, breaking event wiring / client routing | `app/(app)/patients/patients-list.tsx`, `app/(app)/patients/[id]/visit-history/visit-history-content.tsx`, `app/_lib/utils/format-date.ts`, `app/(app)/open-notes/open-notes-content.tsx` | Agent | **fixed in repo / pending redeploy** | live prod still fails; repo fix not yet deployed | **Yes** on current prod |
| RG-3 | Waiting-room handoff fails | doctor -> `/waiting-room` -> click `Assign To Me` on `Cora Mercer` | doctor | `/waiting-room` | server action or client fetch is failing; button loads but no route change; console shows `Error assigning visit: TypeError: Failed to fetch` | `app/(app)/waiting-room/waiting-room-list.tsx`, `app/_actions/visits.ts` (`getPatientOpenVisitAction`, `assignVisitToMeAction`) | Agent / teammate 3 | **open** | live prod failed; no narrow fix implemented yet | **Yes** if waiting-room handoff is in demo |
| RG-4 | No proven save/finalize persistence path | nurse reached `/new-visit` directly, but Save disabled; doctor never reached assign/continue/finalize path | nurse, doctor | `/patients/[id]/new-visit`, `/open-notes`, `/waiting-room` | upstream workflow blocked before persistence validation; fresh new-visit also requires more reviewed sections than a short demo path allows | visit form / handoff path, not yet isolated to one single file | Kejhawn + Agent / teammate 2 | **guarded** | current prod not proven | **Yes** until a redeployed smoke proves save/reopen/finalize |

## Detailed Gate Notes

### RG-1 — Post-login landing broken

- **Evidence:** `phase2_artifacts/1775073517592-nurse-login.png`, `phase2_artifacts/1775073530206-doctor-login.png`
- **Observed behavior:** both users authenticate successfully but land on `/`.
- **Why it matters:** the first visible user action in the demo already looks broken and non-role-aware.
- **Repo fix applied:** full navigation to safe `redirect` or `/`, allowing server-side role resolution from the real session.

### RG-2 — Hydration/navigation failure on core workflow screens

- **Evidence:** `phase2_artifacts/1775073521397-nurse-visit-history.png`, `phase2_artifacts/1775073523713-nurse-visit-form.png`, `phase2_artifacts/1775073534265-doctor-open-notes-continue.png`
- **Observed behavior:** target CTAs are visible but clicking them does not move routes.
- **Console/runtime evidence:** React error `#418` on `/patients`, `/visit-history`, and `/open-notes`.
- **Repo fix applied:** moved critical date rendering onto deterministic shared formatter to reduce hydration mismatch risk.

### RG-3 — Waiting-room assign broken

- **Evidence:** `phase2_artifacts/1775073532648-doctor-assigned-visit.png`
- **Observed behavior:** `Assign To Me` switches to loading, remains on `/waiting-room`, and logs `Error assigning visit: TypeError: Failed to fetch`.
- **Why it matters:** this is the main nurse -> doctor continuity handoff path for the live workflow.
- **Current decision:** no narrow fix applied yet because the live failure needs one more code-level isolation pass before safely changing assignment behavior.

### RG-4 — Persistence not proven

- **Evidence:** `phase2_artifacts/1775073526215-nurse-save-disabled.png`
- **Observed behavior:** direct new-visit route renders, but Save is disabled for the tested fresh workflow.
- **Why it matters:** tomorrow’s demo requires an explainable save/reopen/finalize story.
- **Current decision:** treat fresh new-visit as **disallowed** until a redeployed build proves a pre-seeded continue-note path.

## Batch 1 Execution Update

- **Execution date:** April 3, 2026
- **Branch:** `batch-1-demo-critical-release-gates`
- **Narrow code fix applied:** `app/(app)/waiting-room/waiting-room-list.tsx`
- **What changed:** waiting-room handoff now uses the visit ID already present in the rendered card instead of making a second preflight `getPatientOpenVisitAction()` call before assignment, and successful handoff now full-navigates into the visit editor.
- **Why this is the smallest safe fix:** the waiting-room page already renders the authoritative open visit for the card, so the extra fetch widened the failure surface without improving the approved handoff path.
- **Local validation completed:** `npx tsc --noEmit`, `npx eslint app/(app)/waiting-room/waiting-room-list.tsx`
- **Credential check update:** the tracked demo credentials are valid again against Supabase.
- **Seeded-session local smoke:** `RG-1` now passes locally (`/patients` for nurse, `/waiting-room` for doctor) when the browser is seeded with a real Supabase session.
- **Remaining local findings:** `RG-2` still reproduces under local automation because patient-chart `Visit History`, `Log New Visit`, and `Open Notes -> Continue Note` did not transition routes. `RG-3` remains unproven locally because no visible `Assign To Me` row rendered for the authenticated doctor session in the current local dataset.
