# April 1 Batch 3 Proof Setup

**Purpose:** Define the exact local state and workflow requirements needed to prove `RG-3` and `RG-4` before code changes or behavioral claims.

---

## Assignable Waiting-Room Criteria

An item appears as an assignable waiting-room row only when all of the following are true:

- The current user is authenticated as `doctor` or `nurse`.
- `app/(app)/waiting-room/page.tsx` loads successfully and calls `getUnassignedPatientsWithVisits()`.
- The patient row has `patients.is_assigned = false`.
- The patient has at least one related visit whose status is one of:
  - `"Waiting"`
  - `"waiting"`
  - `"In Progress"`
  - `"in_progress"`
- The waiting-room query maps the most recent matching visit per patient and exposes `visit.id` to the client card.
- The card renders the `Assign To Me` button only when the row is not treated as a virtual already-assigned visit.

### Assign Action Prerequisites

- `WaitingRoomList.handleAssignToMe()` requires a non-null `visitId`.
- `assignVisitToMeAction(visitId)` requires the current user to pass `requireUser(["doctor", "nurse"])`.
- The visit must exist in `getVisitById(visitId)`.
- On success the action:
  - sets `patients.isAssigned = true`
  - sets `patients.clinicianId = currentUser.id`
  - sets `visits.status = "In Progress"`
  - sets `visits.clinicianId = currentUser.id`
  - updates the visit note audit trail
- The UI then full-navigates to `/patients/[patientId]/new-visit?visitId=[visitId]`.

### Filters That Can Suppress Assignable Rows

- `patients.is_assigned` is `null` or `true` instead of `false`
- no visit exists in `"Waiting"` / `"In Progress"` status
- the row is surfaced as a virtual already-assigned visit instead of an assignable waiting-room row
- the local dataset simply does not include any qualifying patient/visit pair

---

## Approved Handoff / Persistence Criteria

For Batch 3, the approved path is the handoff/continuation path, not a random fresh blank visit.

### Required Visit State

- Start from a real existing visit reachable by:
  - waiting-room handoff (`Assign To Me`), or
  - doctor `Open Notes -> Continue Note`
- Prefer an existing `visitId` so the form loads in **Continue Visit** mode.
- Existing visit data must load through `app/(app)/patients/[id]/new-visit/page.tsx`, which passes:
  - `existingVisitId`
  - `existingVisitData`
  - appointment/call metadata

### Save Gating Rules

- `Save Visit` is disabled unless:
  - `isSaving === false`
  - `allSectionsReviewed === true`
  - `isOnline === true`
- `allSectionsReviewed` is computed from `getSectionsForRole(userRole)`.
- Continue-path visits are intended to bypass the original review-blocker because existing visits pre-mark all visible sections as reviewed when there is no Dexie draft overriding state.

### Persistence Lifecycle Rules

- Save path uses `handleFinalize()` in `NewVisitForm`.
- If `visitIdRemote` exists:
  - `updateVisitDraftAction(visitIdRemote, { notesJson })`
- If `visitIdRemote` does not exist:
  - `createVisitDraftAction(...)`
- Save success does **not** sign automatically.
- After save, the post-save modal allows:
  - `View Patient`
  - `Send to Waiting Room`
  - `Sign the Note`

### Finalize / Sign Rules

- `finalizeVisitAction()` allows sign when either is true:
  - `patients.clinicianId === currentUser.id`
  - `visits.clinicianId === currentUser.id`
- `handlePostSaveAction("sign")`:
  - calls `finalizeVisitAction(visitIdRemote, "signed")`
  - then calls `updatePatientAssignedAction(patientId, null)`
  - then routes to `/patients/[id]/visit-history`
- Signed visits should later reopen through visit history / visit details and reflect signed state.

---

## Exact Routes Involved

### RG-3

- `/waiting-room`
- `/patients/[id]/new-visit?visitId=...`

### RG-4

- `/patients/[id]/new-visit?visitId=...`
- `/patients/[id]/visit-history`
- `/patients/[id]/visit-history/[visitId]`
- `/open-notes`
- `/patients/[id]/send-to-waiting-room?visitId=...` when the waiting-room branch is part of the proof

---

## Exact Files / Functions Involved

### Waiting-Room / Handoff

- `app/(app)/waiting-room/page.tsx`
- `app/(app)/waiting-room/waiting-room-list.tsx`
- `app/_lib/hooks/use-waiting-room-realtime.ts`
- `app/_lib/db/drizzle/queries/patients.ts`
  - `getUnassignedPatientsWithVisits()`
- `app/_actions/visits.ts`
  - `assignVisitToMeAction()`
  - `updateVisitWaitingRoomAction()`
  - `getPatientOpenVisitAction()`
- `app/_lib/db/drizzle/queries/visit.ts`
  - `getVisitById()`
  - `getPatientOpenVisit()`

### Save / History / Reopen / Finalize

- `app/(app)/patients/[id]/new-visit/page.tsx`
- `app/_components/visit/new-visit-form.tsx`
  - `handleFinalize()`
  - `handlePostSaveAction()`
  - continue-path reviewed-sections setup
- `app/_components/visit/section-stepper.tsx`
  - `getSectionsForRole()`
- `app/_actions/visits.ts`
  - `createVisitDraftAction()`
  - `updateVisitDraftAction()`
  - `finalizeVisitAction()`
  - `updatePatientAssignedAction()`
  - `markVisitInProgressAction()`
- `app/_lib/db/drizzle/queries/visit.ts`
  - `createVisitDraft()`
  - `updateVisitDraft()`
  - `finalizeVisit()`
  - `markVisitInProgress()`
  - `getVisitDetails()`
- `app/_lib/db/drizzle/queries/visit-history.ts`
  - `getVisitHistory()`
- `app/(app)/patients/[id]/visit-history/page.tsx`
- `app/(app)/patients/[id]/visit-history/visit-history-content.tsx`
- `app/(app)/patients/[id]/visit-history/[visitId]/page.tsx`
- `app/(app)/patients/[id]/visit-history/[visitId]/visit-details-content.tsx`
- `app/api/visits/[visitId]/recording/finalize/route.ts`
  - only validation-adjacent if the proof reaches recording finalize

---

## Local / Setup Prerequisites

- Valid demo users:
  - `demonurse@telehealth.com`
  - `demodoctor@telehealth.com`
- A patient/visit pair that satisfies either:
  - waiting-room assignability (`is_assigned = false`, open visit in waiting/in-progress state), or
  - doctor continuation visibility (`visits.clinician_id = doctor.id` with open status)
- Local app running with real Supabase / database environment
- If the current dataset lacks an assignable row, the smallest safe local setup is:
  - identify an existing demo patient/visit pair
  - update only the minimal patient/visit fields needed to enter the waiting-room state
  - use that pair for RG-3 and then continue directly into RG-4 proof

## Local Proof Setup Used In This Run

- Reused the existing validation patient `Cora Mercer` (`cdfc2a9e-680b-406b-85b9-82d3d7274c66`) and visit `94ecb626-334f-49da-9a4f-de292e04e963`.
- Reset the pair into a nurse-owned continuation state before browser validation:
  - `patients.is_assigned = true`
  - `patients.clinician_id = demonurse`
  - `visits.status = "In Progress"`
  - `visits.clinician_id = demonurse`
  - `visits.notes_status = "draft"`
  - latest note status reset to `draft`
- Used the real UI handoff path after that setup:
  1. nurse opened `Continue Visit`
  2. nurse saved
  3. nurse used `Send to Waiting Room`
  4. doctor opened `/waiting-room`
  5. doctor used `Assign To Me`
  6. doctor saved, reopened from history, and signed

### Batch 3 Repo Fixes Confirmed By This Setup

- `app/_components/visit/new-visit-form.tsx`
  - save success now restores the post-save modal even when the save action triggers a route refresh
- `app/_actions/visits.ts`
  - `updateVisitWaitingRoomAction()` now revalidates waiting-room and visit/patient caches so the doctor immediately sees the new assignable row after the nurse handoff

---

## What Must Be Proven In This Batch

### RG-3 proof

1. visible assignable waiting-room row
2. `Assign To Me` click resolves
3. route transitions into the correct note/editor path
4. no fetch/auth/route failure in that handoff

### RG-4 proof

1. open approved in-progress / handoff visit
2. edit content
3. save successfully
4. verify saved state persists
5. open Visit History
6. reopen same visit
7. verify persisted content still loads
8. finalize/sign as legitimate provider
9. verify signed/final state is reflected afterward
