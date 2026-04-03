# April 1 Master Release Timeline

**Scope:** Demo-critical release stabilization history for `tele-medical` based on the April 1 / Phase 2 markdown record only.  
**Purpose:** Preserve a single chronological source for what was found, what was fixed in repo, what was validated live, and what remained open or guarded before demo release decisions.

---

## Release-State Legend

| State | Meaning |
|---|---|
| `fixed locally` | Documented as fixed in repo or local code review, but not yet proven on the deployed build |
| `fixed and validated` | Documented as fixed and behaviorally proven in validation |
| `fixed locally but not yet deployed` | Explicitly fixed in repo, but Phase 2 docs say the live deployment had not yet received the fix |
| `still open` | Explicit blocker with no documented narrow fix at that point in the record |
| `guarded/deferred` | Deliberately not treated as green; either excluded from demo path or deferred beyond the stabilization pass |

---

## Chronological Timeline

| Time / phase | Source | What happened | Normalized outcome |
|---|---|---|---|
| April 1, 2026, baseline audit | [`April 1 Audit.md`](./April%201%20Audit.md) | The audit establishes the initial risk map: session instability from `getServerSession()`, dead `Log History` route, blocked save flow, incorrect continue-visit title, shallow social-history merge, and unclear finalize rules for handoff. | Baseline findings created; nothing validated yet |
| April 1, 2026, audit stabilization sequence | [`April 1 Audit.md`](./April%201%20Audit.md) | P0/P1/P2 prioritization is proposed: route recovery, session stabilization, continue-visit title, social merge, save gating clarity, status labels, and finalize authorization. | Batch ordering implied for stabilization work |
| April 1, 2026, first stabilization tracker | [`April 1 Demo Stabilization Tracker.md`](./April%201%20Demo%20Stabilization%20Tracker.md) | Stabilization converts the audit into agent-owned work. P0 issues are marked fixed for session cooldown, middleware auth skip, dead `/log-history`, continue-note title, continue-path save gating, and finalize assignee checks. | Multiple demo blockers documented as `fixed locally` |
| April 1, 2026, first stabilization tracker | [`April 1 Demo Stabilization Tracker.md`](./April%201%20Demo%20Stabilization%20Tracker.md) | Social-history merge and status-label normalization are documented as fixed. Fresh new-visit gating is left intentional unless product changes. Vitals / PMH / orders issues are not reproduced in code review. | Mixed state: `fixed locally` for social/status work; `guarded/deferred` for fresh new-visit UX; some reported failures remain unproven |
| April 1, 2026, hotspot tracker pass | [`APRIL_1_DEMO_STABILIZATION_TRACKER.md`](./APRIL_1_DEMO_STABILIZATION_TRACKER.md) | The second tracker normalizes hotspot issues H-1 through H-4 and adds NEW-1 / NEW-2. It records React render-pattern fixes in `patients-list.tsx` and assignee-rule parity for recording finalize + visit-details sign visibility. | Additional issues marked `fixed locally` |
| April 1, 2026, hotspot tracker pass | [`APRIL_1_DEMO_STABILIZATION_TRACKER.md`](./APRIL_1_DEMO_STABILIZATION_TRACKER.md) | Explicit deferrals are recorded: repo-wide ESLint cleanup, `visit-details-content.tsx` typing/a11y debt, Twilio complexity, and offline/sync unless directly on the demo path. | `guarded/deferred` items clearly separated from demo-critical work |
| April 1, 2026, summary rollup | [`APRIL_1_DEMO_STABILIZATION_SUMMARY.md`](./APRIL_1_DEMO_STABILIZATION_SUMMARY.md) | Summary states **DEMO READY WITH GUARDRAILS** from the repo perspective. Core route fixes, continue-path behavior, and finalize authorization are described as improved, but Twilio/media and older visit-details JSON remain risky. | Repo posture improves, but live validation still required |
| April 1, 2026, ~19:58 UTC, Phase 2 live validation begins | [`APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md) | Live production testing starts against `tele-medical.vercel.app`. Demo users authenticate, direct route loads work, and the shared patient `Cora Mercer` is visible. | Narrow set of items `fixed and validated` on the live build |
| April 1, 2026, ~19:58 UTC, nurse path | [`APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md) | Nurse lands on `/` instead of `/patients`; `Visit History` click fails; `Log New Visit` click fails; direct route loads pass; save remains disabled on the tested fresh new-visit path. | Role landing and client navigation become live blockers; fresh new-visit remains `guarded/deferred` |
| April 1, 2026, ~19:58 UTC, doctor path | [`APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md) | Doctor lands on `/` instead of `/waiting-room`; waiting-room page loads directly; `Assign To Me` fails with `TypeError: Failed to fetch`; `/open-notes` loads but `Continue Note` does not navigate. | Handoff and continuation path remain blocked on live production |
| April 1, 2026, live runtime evidence | [`APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md), [`APRIL_1_PHASE2_DEMO_VALIDATION_FINDINGS.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_FINDINGS.md) | Repeated hydration/runtime errors are captured on `/patients`, `/visit-history`, and `/open-notes`, suggesting client navigation is broken by hydration mismatch instead of missing pages. | Live blocker confirmed; root-cause direction tightened |
| April 1, 2026, same validation pass | [`APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md) | Repo fixes are documented for post-login full navigation and deterministic date rendering on key client screens, but the tracker explicitly says those fixes were not re-validated on the live site because production had not been redeployed. | `fixed locally but not yet deployed` for role landing and hydration/navigation fixes |
| April 1, 2026, validation findings synthesized | [`APRIL_1_PHASE2_DEMO_VALIDATION_FINDINGS.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_FINDINGS.md) | Findings state current production is not stable enough for demo, there is no approved full path on the current deployment, and only a pre-seeded continue-note path should be considered after redeploy and smoke. | Demo confidence drops to low on live production |
| April 1, 2026, release gates formalized | [`APRIL_1_PHASE2_RELEASE_GATES.md`](./APRIL_1_PHASE2_RELEASE_GATES.md) | Four release gates are defined: RG-1 role landing, RG-2 hydrated navigation, RG-3 waiting-room assign, RG-4 persistence chain. RG-1 and RG-2 are marked fixed in repo / pending redeploy; RG-3 is open; RG-4 is guarded. | Final normalized blocker set established |
| April 1, 2026, guardrails published | [`APRIL_1_PHASE2_DEMO_GUARDRAILS.md`](./APRIL_1_PHASE2_DEMO_GUARDRAILS.md) | The allowed presenter path is narrowed to isolated sessions, one approved patient/visit pair, and a pre-seeded continue path only after same-day smoke. Unrehearsed waiting-room, open-notes, fresh new-visit, Twilio, recording, and AI branches are explicitly disallowed. | Demo path constrained by `guarded/deferred` rules |
| April 1, 2026, final verdict | [`APRIL_1_PHASE2_FINAL_VERDICT.md`](./APRIL_1_PHASE2_FINAL_VERDICT.md) | Final verdict is **NOT DEMO READY** for the current live deployment because role landing, client navigation, waiting-room assignment, and persistence were not proven end-to-end. | Live deployment rejected for presenter use |
| April 2, 2026, runbook assembled | [`April 2 Demo Runbook.md`](./April%202%20Demo%20Runbook.md), [`Known Risks to Avoid in Demo.md`](./Known%20Risks%20to%20Avoid%20in%20Demo.md) | The runbook and risk sheet convert the release record into presenter instructions: use isolated users, prefer continue-note paths, avoid fresh new visits unless Save is proven, and keep Twilio/AI optional. | Execution guidance aligned to guarded release posture |
| April 3, 2026, Batch 1 authenticated local smoke | [`APRIL_1_BATCH_PROGRESS_LOG.md`](./APRIL_1_BATCH_PROGRESS_LOG.md), [`APRIL_1_PHASE2_RELEASE_GATES.md`](./APRIL_1_PHASE2_RELEASE_GATES.md) | Restored demo credentials are re-checked against Supabase. Seeded-session local smoke proves role landing on the current branch (`/patients` for nurse, `/waiting-room` for doctor), separating auth correctness from the remaining route continuity issues. | `RG-1` locally re-validated; deployed smoke still pending |
| April 3, 2026, Batch 2 routing continuity pass | [`APRIL_1_BATCH_PROGRESS_LOG.md`](./APRIL_1_BATCH_PROGRESS_LOG.md), [`APRIL_1_PHASE2_RELEASE_GATES.md`](./APRIL_1_PHASE2_RELEASE_GATES.md) | Batch 2 narrows route continuity to the demo-critical patient lane. Invalid button-in-link CTA markup is corrected on patient-chart, visit-history, and open-notes actions, and remaining patient-route date output is made more deterministic where it still directly touched those flows. | `RG-2` locally re-validated on the current branch; waiting-room and persistence gates remain open |

---

## Normalized Demo-Critical History

### Repo-fixed before live redeploy

| Item | Source(s) | State |
|---|---|---|
| Session cooldown / middleware auth skip | [`April 1 Demo Stabilization Tracker.md`](./April%201%20Demo%20Stabilization%20Tracker.md), [`APRIL_1_DEMO_STABILIZATION_TRACKER.md`](./APRIL_1_DEMO_STABILIZATION_TRACKER.md) | `fixed locally` |
| Dead `Log History` route | [`April 1 Demo Stabilization Tracker.md`](./April%201%20Demo%20Stabilization%20Tracker.md), [`APRIL_1_DEMO_STABILIZATION_TRACKER.md`](./APRIL_1_DEMO_STABILIZATION_TRACKER.md) | `fixed locally` |
| Continue-note title / continue-path reviewed sections | [`April 1 Demo Stabilization Tracker.md`](./April%201%20Demo%20Stabilization%20Tracker.md), [`APRIL_1_DEMO_STABILIZATION_TRACKER.md`](./APRIL_1_DEMO_STABILIZATION_TRACKER.md) | `fixed locally` |
| Finalize assignee parity (`patient.clinicianId` or `visit.clinicianId`) | [`April 1 Demo Stabilization Tracker.md`](./April%201%20Demo%20Stabilization%20Tracker.md), [`APRIL_1_DEMO_STABILIZATION_TRACKER.md`](./APRIL_1_DEMO_STABILIZATION_TRACKER.md) | `fixed locally` |
| Social-history nested merge | [`April 1 Demo Stabilization Tracker.md`](./April%201%20Demo%20Stabilization%20Tracker.md), [`APRIL_1_DEMO_STABILIZATION_TRACKER.md`](./APRIL_1_DEMO_STABILIZATION_TRACKER.md) | `fixed locally` |
| Patient-list render-pattern fix | [`APRIL_1_DEMO_STABILIZATION_TRACKER.md`](./APRIL_1_DEMO_STABILIZATION_TRACKER.md), [`APRIL_1_DEMO_STABILIZATION_SUMMARY.md`](./APRIL_1_DEMO_STABILIZATION_SUMMARY.md) | `fixed locally` |
| Visit-details sign visibility + recording finalize parity | [`APRIL_1_DEMO_STABILIZATION_TRACKER.md`](./APRIL_1_DEMO_STABILIZATION_TRACKER.md), [`APRIL_1_DEMO_STABILIZATION_SUMMARY.md`](./APRIL_1_DEMO_STABILIZATION_SUMMARY.md) | `fixed locally` |

### Fixed in repo but explicitly not yet deployed during Phase 2

| Item | Source(s) | State |
|---|---|---|
| Post-login landing full-navigation fix | [`APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md), [`APRIL_1_PHASE2_RELEASE_GATES.md`](./APRIL_1_PHASE2_RELEASE_GATES.md) | `fixed locally but not yet deployed` |
| Deterministic date-rendering fix for hydrated screens | [`APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md), [`APRIL_1_PHASE2_RELEASE_GATES.md`](./APRIL_1_PHASE2_RELEASE_GATES.md) | `fixed locally but not yet deployed` |

### Proven on the live deployment

| Item | Source(s) | State |
|---|---|---|
| Demo credentials authenticate | [`APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md), [`APRIL_1_PHASE2_FINAL_VERDICT.md`](./APRIL_1_PHASE2_FINAL_VERDICT.md) | `fixed and validated` |
| Direct route loads for `/patients`, `/waiting-room`, `/visit-history`, `/new-visit`, `/open-notes` | [`APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md), [`APRIL_1_PHASE2_DEMO_VALIDATION_FINDINGS.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_FINDINGS.md) | `fixed and validated` |
| Shared demo patient visible in nurse and doctor contexts | [`APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md), [`APRIL_1_PHASE2_FINAL_VERDICT.md`](./APRIL_1_PHASE2_FINAL_VERDICT.md) | `fixed and validated` |

### Still open at the end of the record

| Item | Source(s) | State |
|---|---|---|
| Waiting-room `Assign To Me` failure | [`APRIL_1_PHASE2_RELEASE_GATES.md`](./APRIL_1_PHASE2_RELEASE_GATES.md) | `still open` |

### Guarded or deliberately deferred

| Item | Source(s) | State |
|---|---|---|
| Fresh new-visit save path for the short demo | [`APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md), [`APRIL_1_PHASE2_DEMO_GUARDRAILS.md`](./APRIL_1_PHASE2_DEMO_GUARDRAILS.md), [`Known Risks to Avoid in Demo.md`](./Known%20Risks%20to%20Avoid%20in%20Demo.md) | `guarded/deferred` |
| Save -> history -> reopen -> finalize persistence chain on live deployment | [`APRIL_1_PHASE2_RELEASE_GATES.md`](./APRIL_1_PHASE2_RELEASE_GATES.md), [`APRIL_1_PHASE2_FINAL_VERDICT.md`](./APRIL_1_PHASE2_FINAL_VERDICT.md) | `guarded/deferred` |
| Social-history merge validation on live deployment | [`APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md`](./APRIL_1_PHASE2_DEMO_VALIDATION_TRACKER.md), [`APRIL_1_PHASE2_FINAL_VERDICT.md`](./APRIL_1_PHASE2_FINAL_VERDICT.md) | `guarded/deferred` |
| Twilio / recording / AI demo path | [`APRIL_1_DEMO_STABILIZATION_SUMMARY.md`](./APRIL_1_DEMO_STABILIZATION_SUMMARY.md), [`APRIL_1_PHASE2_DEMO_GUARDRAILS.md`](./APRIL_1_PHASE2_DEMO_GUARDRAILS.md), [`Known Risks to Avoid in Demo.md`](./Known%20Risks%20to%20Avoid%20in%20Demo.md) | `guarded/deferred` |
| Repo-wide lint / typing / a11y cleanup | [`APRIL_1_DEMO_STABILIZATION_TRACKER.md`](./APRIL_1_DEMO_STABILIZATION_TRACKER.md), [`APRIL_1_DEMO_STABILIZATION_SUMMARY.md`](./APRIL_1_DEMO_STABILIZATION_SUMMARY.md) | `guarded/deferred` |

---

## Timeline Takeaways

1. The markdown history consistently separates **repo state** from **deployed production state**.
2. By the end of the April 1 record, the release question is no longer “what are the demo blockers?” but “which blockers are already fixed locally, and which still need redeploy-time proof?”
3. The final release-gate framing is the right execution frame:
   - `RG-1` role landing
   - `RG-2` hydrated route continuity
   - `RG-3` waiting-room handoff
   - `RG-4` persistence proof
4. The safe Batch 1 target is therefore to close those gates only, not to broaden into repo hygiene or optional telehealth automation work.
