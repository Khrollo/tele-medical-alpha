# April 1 Batch Progress Log

**Purpose:** Execution-time tracking for the April 1 release stabilization batches.  
**Rule:** Keep this file status-oriented. Do not turn it into an implementation diary.

---

## Status Key

| Status | Meaning |
|---|---|
| `not started` | Batch has not been opened |
| `in progress` | Batch is actively being worked |
| `blocked` | Batch cannot continue without a new decision or external validation |
| `ready for validation` | Code/work is complete and awaiting batch validation |
| `validated` | Batch has passed its planned validation |
| `deferred` | Batch intentionally left out of the current release pass |

---

## Batch 1 — Close Demo-Critical Release Gates

| Field | Value |
|---|---|
| Owner | `GPT-5.4` |
| Branch | `batch-1-demo-critical-release-gates` |
| PR title | `Batch 1: close demo-critical release gates` |
| Status | `in progress` |
| Started at | `2026-04-03 02:11 UTC` |
| Finished at | `2026-04-03 02:19 UTC` |
| Validation owner | `GPT-5.4` |
| Validation result | `TypeScript + touched-file ESLint passed. Direct Supabase auth confirmed the tracked demo credentials, and seeded-session local smoke now proves role landing (`/patients` for nurse, `/waiting-room` for doctor). However, core demo-path UI route continuity still reproduces locally (`Visit History`, `Log New Visit`, and `Continue Note` did not transition routes under automation), and waiting-room assign could not be proven because no assignable row rendered in the local dataset.` |
| Deploy target validated | `No` |

### Execution notes

- Narrow code change applied only to the Batch 1 open handoff path in `app/(app)/waiting-room/waiting-room-list.tsx`.
- Waiting-room `Assign To Me` now uses the visit ID already loaded on the card instead of doing a second preflight server-action fetch before assignment.
- Post-assign navigation now uses a full-page transition into `/patients/[id]/new-visit?visitId=...` to keep the handoff path on a fresh server render.
- Direct Supabase auth now succeeds for `demonurse@telehealth.com` and `demodoctor@telehealth.com` with the restored demo password.
- Seeded-session local smoke proves `RG-1` locally: nurse lands on `/patients`, doctor lands on `/waiting-room`.
- Seeded-session local smoke still reproduces `RG-2`: patient-chart `Visit History`, `Log New Visit`, and `Open Notes -> Continue Note` did not navigate during automated local verification.
- `RG-3` remains unproven locally because `/waiting-room` rendered with no visible `Assign To Me` button for the authenticated doctor session in the current local dataset.

### Validation checklist result

- [ ] Nurse lands on `/patients`
- [ ] Doctor lands on `/waiting-room`
- [ ] Patient chart `Visit History` works
- [ ] `Open Notes -> Continue Note` works
- [ ] `Assign To Me` is either proven or explicitly removed from presenter path
- [ ] Save -> history -> reopen -> finalize/sign proven on approved record
- [ ] No hydration/runtime route break on core demo screens
- [ ] Isolated nurse/doctor sessions confirmed

---

## Batch 2 — Harden Approved Continuation Path

| Field | Value |
|---|---|
| Owner | `GPT-5.4` |
| Branch | `fix/demo-batch-2-routing` |
| PR title | `Batch 2: Repair patient routing and visit-history continuity` |
| Status | `ready for validation` |
| Started at | `2026-04-03 02:24 UTC` |
| Finished at | `2026-04-03 02:43 UTC` |
| Validation owner | `GPT-5.4` |
| Validation result | `Batch 2 route-continuity fixes pass local authenticated smoke on the current branch: patient list -> chart, chart -> Visit History, Visit History -> existing visit, chart/history -> Log New Visit, and Open Notes -> Continue Note all transition successfully with no 404 response or client runtime error captured. Deploy-time validation is still pending.` |
| Deploy target validated | `No` |

### Batch 2 Issue List

| Issue | Route | Likely file(s) | Repro status | Priority |
|---|---|---|---|---|
| Invalid CTA nesting on demo-critical route actions | `/patients/[id]`, `/patients/[id]/visit-history`, `/open-notes` | `app/_components/patient-chart/patient-chart-shell.tsx`, `app/(app)/patients/[id]/visit-history/visit-history-content.tsx`, `app/(app)/open-notes/open-notes-content.tsx` | Reproduced locally before fix | `P0` |
| Hydration-sensitive patient route rendering | `/patients`, `/patients/[id]` | `app/(app)/patients/patients-list.tsx`, `app/(app)/patients/[id]/patient-overview-cards.tsx` | Reproduced historically; narrowed as shared render-risk in current pass | `P0` |
| Existing visit continuity needed explicit re-check | `/patients/[id]/visit-history/[visitId]` | `app/(app)/patients/[id]/visit-history/**` | Reproduced as a Batch 2 verification target | `P1` |

### Batch 2 Notes

- **Batch dependency:** this branch is based on `batch-1-demo-critical-release-gates` because Batch 1 docs and local release-gate findings were not yet merged to `main`.
- **Issues targeted:** patient chart `Visit History`, patient chart / visit-history `Log New Visit`, visit-history existing visit continuity, and doctor `Open Notes -> Continue Note`.
- **Files changed:** `app/_components/patient-chart/patient-chart-shell.tsx`, `app/(app)/patients/[id]/visit-history/visit-history-content.tsx`, `app/(app)/open-notes/open-notes-content.tsx`, `app/(app)/patients/[id]/patient-overview-cards.tsx`, `app/(app)/patients/patients-list.tsx`.
- **Why each change was made:** convert invalid button-in-link CTAs to `Button asChild` links on the exact demo-critical navigation buttons, and replace remaining patient-route date/age rendering that could still produce hydration-sensitive output on the chart continuity path.
- **Validation commands run:** `npx tsc --noEmit`, `npx eslint` on the five touched files, seeded-session Playwright smoke against `localhost:3000`.
- **Remaining route/navigation risks:** waiting-room handoff is still outside Batch 2 completion and still needs proof on an assignable record; deployed smoke is still required before any release gate can be considered green for demo use.
- **Closer to demo-ready after Batch 2?:** `Yes` for the patient navigation continuity lane. The app is materially closer because the local continuation path now transitions correctly across the core patient/chart/open-notes surfaces.

### Validation checklist result

- [x] Only Batch 1 spillover issues were addressed
- [x] Continue / reopen route continuity is stable locally on the approved path
- [x] No unrelated cleanup drift entered scope

---

## Batch 3 — Optional Telehealth / AI Rehearsal

| Field | Value |
|---|---|
| Owner | `TBD` |
| Branch | `TBD` |
| PR title | `TBD` |
| Status | `not started` |
| Started at | `TBD` |
| Finished at | `TBD` |
| Validation owner | `TBD` |
| Validation result | `TBD` |
| Deploy target validated | `TBD` |

### Validation checklist result

- [ ] Twilio / call path rehearsed on deployed build
- [ ] Recording path rehearsed on deployed build
- [ ] AI/transcription path rehearsed on deployed build
- [ ] Presenter path still excludes any unrehearsed branches

---

## Release Decision Snapshot

| Field | Value |
|---|---|
| Current recommended presenter batch | `Batch 2` |
| Current approved demo path | `Role-correct sign-in -> patient chart / visit-history / continue-note route continuity -> save -> history -> reopen -> finalize/sign on one approved record` |
| Current blocked path(s) | `Waiting-room assign still needs proof on an assignable record; save/history/reopen/finalize still need deployed smoke on the approved record` |
| Last updated by | `GPT-5.4` |
| Last updated at | `2026-04-03 02:43 UTC` |
