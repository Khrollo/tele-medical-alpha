# April 1 Phase 2 Release Gates

## Gate List (highest risk first)

| ID | Blocker | Reproduction steps | Affected role(s) | Affected route(s) | Root cause hypothesis | Code area implicated | Fix owner | Status | Re-test result | Remains demo blocker? |
|---|---|---|---|---|---|---|---|---|---|---|
| RG-1 | Post-login landing goes to `/` instead of role home | Sign in as nurse or doctor on live prod | nurse, doctor | `/sign-in` -> `/` | client redirect trusts `user_metadata.role` and uses SPA navigation instead of server-verified session/DB role | `app/(auth)/sign-in/sign-in-form.tsx` | Agent | **fixed in repo / locally re-validated / pending deployed smoke** | live prod still fails; current branch seeded-session smoke lands on `/patients` for nurse and `/waiting-room` for doctor | **Yes** until deployed smoke |
| RG-2 | Client navigation dead on hydrated workflow screens | nurse: patient chart `Visit History`; visit history `Log New Visit`; doctor: `Open Notes` -> `Continue Note` | nurse, doctor | `/patients`, `/patients/[id]/visit-history`, `/open-notes` | hydration mismatch (`React error #418`) and brittle CTA markup on route buttons | `app/(app)/patients/patients-list.tsx`, `app/(app)/patients/[id]/patient-overview-cards.tsx`, `app/_components/patient-chart/patient-chart-shell.tsx`, `app/(app)/patients/[id]/visit-history/visit-history-content.tsx`, `app/(app)/open-notes/open-notes-content.tsx`, `app/_lib/utils/format-date.ts` | Agent | **fixed in repo / locally re-validated / pending deployed smoke** | live prod still fails; current branch seeded-session smoke passes `Visit History`, `Log New Visit`, visit detail, and `Continue Note` transitions locally | **Yes** until deployed smoke |
| RG-3 | Waiting-room handoff fails | doctor -> `/waiting-room` -> click `Assign To Me` on approved waiting-room record | doctor | `/waiting-room` | previously blocked by missing local proof state and stale waiting-room cache after nurse handoff | `app/_components/visit/new-visit-form.tsx`, `app/_actions/visits.ts`, `app/(app)/waiting-room/waiting-room-list.tsx` | Agent | **fixed and behaviorally validated locally** | local Batch 3 smoke now proves nurse save -> send to waiting room -> doctor sees assignable row -> `Assign To Me` routes into `/patients/[id]/new-visit?visitId=...`; hosted smoke still pending | **Yes** until deployed smoke |
| RG-4 | No proven save/finalize persistence path | approved nurse -> doctor handoff record -> save -> history -> reopen -> sign | nurse, doctor | `/patients/[id]/new-visit`, `/patients/[id]/send-to-waiting-room`, `/waiting-room`, `/patients/[id]/visit-history`, `/patients/[id]/visit-history/[visitId]` | previously blocked by post-save next-step continuity breaking after save refresh and by missing approved proof setup | `app/_components/visit/new-visit-form.tsx`, `app/_actions/visits.ts`, visit history / detail routes for validation | Agent | **fixed and behaviorally validated locally** | local Batch 3 smoke now proves doctor save persistence, history/detail reopen with expected content, and sign success on the same record; hosted smoke still pending | **Yes** until deployed smoke |

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
- **Batch 2 fix applied:** converted demo-critical CTA surfaces to valid `Button asChild` links on patient chart / visit-history / open-notes and removed remaining hydration-sensitive patient-route date output that still directly touched those screens.
- **Batch 2 local re-test:** seeded-session smoke on the current branch now passes:
  - `/patients` -> `/patients/[id]`
  - patient chart -> `/patients/[id]/visit-history`
  - visit history -> `/patients/[id]/visit-history/[visitId]`
  - patient chart / visit history -> `/patients/[id]/new-visit`
  - `/open-notes` -> `/patients/[id]/new-visit?visitId=...`

### RG-3 — Waiting-room assign broken

- **Evidence:** `phase2_artifacts/1775073532648-doctor-assigned-visit.png`
- **Observed behavior:** `Assign To Me` switches to loading, remains on `/waiting-room`, and logs `Error assigning visit: TypeError: Failed to fetch`.
- **Why it matters:** this is the main nurse -> doctor continuity handoff path for the live workflow.
- **Batch 3 proof setup:** `Cora Mercer` / `94ecb626-334f-49da-9a4f-de292e04e963` was reset locally into a nurse-owned `In Progress` visit, then the real nurse UI path was used to save and send it back to waiting room.
- **Batch 3 code change:** `updateVisitWaitingRoomAction()` now revalidates waiting-room / patient / visit caches so the doctor sees the new assignable row immediately after the nurse handoff.
- **Batch 3 local re-test:** doctor waiting room now shows the assignable row locally, `Assign To Me` resolves, and the route transitions into `/patients/[id]/new-visit?visitId=...` on the current branch.
- **Current status label:** `fixed and behaviorally validated locally`

### RG-4 — Persistence not proven

- **Evidence:** `phase2_artifacts/1775073526215-nurse-save-disabled.png`
- **Observed behavior:** direct new-visit route renders, but Save is disabled for the tested fresh workflow.
- **Why it matters:** tomorrow’s demo requires an explainable save/reopen/finalize story.
- **Batch 3 operating rule applied:** fresh blank new-visit remained out of scope; proof was built on the approved existing `visitId` continuation path instead.
- **Batch 3 code change:** `new-visit-form.tsx` now restores the post-save modal across the save-triggered route refresh so the nurse and doctor can continue into the next explicit workflow step after saving.
- **Batch 3 local re-test:** nurse save -> send to waiting room, doctor assign -> continue note -> save, visit-history/detail reopen, and sign all pass locally on the same record; a fresh history-page reload also later reflects `Signed & Complete`.
- **Current status label:** `fixed and behaviorally validated locally`

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

## Batch 2 Execution Update

- **Execution date:** April 3, 2026
- **Branch:** `fix/demo-batch-2-routing`
- **Batch dependency:** built on top of `batch-1-demo-critical-release-gates` because Batch 1 release docs and local gate findings were not yet merged to `main`
- **Files changed:** `app/_components/patient-chart/patient-chart-shell.tsx`, `app/(app)/patients/[id]/visit-history/visit-history-content.tsx`, `app/(app)/open-notes/open-notes-content.tsx`, `app/(app)/patients/[id]/patient-overview-cards.tsx`, `app/(app)/patients/patients-list.tsx`
- **Why these changes were made:** remove invalid CTA nesting on demo-critical route actions and reduce remaining hydration-sensitive route output on the patient navigation lane without widening the batch into unrelated cleanup
- **Local validation completed:** `npx tsc --noEmit`, `npx eslint` on the five touched files, seeded-session Playwright smoke against `localhost:3000`
- **Local validation result:** patient list -> chart, chart -> visit history, visit history -> existing visit, patient chart / visit history -> `Log New Visit`, and doctor `Open Notes -> Continue Note` all transition successfully on the current branch with no 404 response or client runtime error captured
- **Remaining blocker posture after Batch 2:** `RG-3` waiting-room assign remains unproven locally and `RG-4` persistence still needs an approved-record deployed smoke

## Batch 3 Execution Update

- **Execution date:** April 3, 2026
- **Branch:** `fix/demo-batch-3-handoff-persistence`
- **Files changed:** `app/_components/visit/new-visit-form.tsx`, `app/_actions/visits.ts`
- **Why these changes were made:** preserve the post-save action surface across save-triggered refreshes, and make waiting-room assignment immediately provable again after the nurse handoff by invalidating the cached waiting-room data when a visit is sent back to queue
- **Proof setup used:** existing `Cora Mercer` visit `94ecb626-334f-49da-9a4f-de292e04e963` was reset locally into a nurse-owned `In Progress` record before exercising the real nurse -> doctor handoff path
- **Local validation completed:** `npx tsc --noEmit`, `npx eslint app/_components/visit/new-visit-form.tsx app/_actions/visits.ts`, authenticated Playwright smoke against `localhost:3000`, direct DB checks for patient / visit / note state
- **Local validation result:** nurse save -> send to waiting room -> doctor `Assign To Me` -> doctor save -> history/detail reopen -> sign now works locally on the current branch, and the persisted doctor-authored note content survives the reopen step
- **Remaining blocker posture after Batch 3:** hosted deployment smoke is still required before RG-3 / RG-4 can be treated as green for demo use on the actual deployed build
