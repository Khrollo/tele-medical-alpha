# Telemedicine Platform — Status, Progress & Roadmap

**Prepared for:** Ilya Rabkin, Dennis Wilmot, Carlton Gordon, Anubis Watal  
**Team:** Kejhawn Brown, Tenoy Wilson, JayDbb  
**Date:** April 7, 2026  
**Runtime:** ~5 minutes

---

## Slide 1 — Platform at a Glance

**What it is:** A browser-based clinical workflow platform for urgent-care and medical-mission settings — patient intake, clinical documentation, AI-assisted note capture, and telehealth video visits.

| Capability | Status |
|---|---|
| Patient creation & chart | Live |
| Waiting room queue (in-person + virtual) | Live |
| Clinical visit documentation (multi-section notes) | Live |
| AI voice capture & auto-parse into structured notes | Live |
| Browser-first live speech recognition | Live (new) |
| AI patient voice intake (demographics from speech) | Live (new) |
| Telehealth video calls (Twilio) | Live |
| Patient join link (SMS-delivered) | Live |
| Role-based access (Doctor / Nurse) | Live |
| Offline draft persistence & outbox sync | Live |
| Consent signature capture & storage | Live |
| CI/CD: TypeScript checks, Next.js build, Vercel preview deploys | Live |

---

## Slide 2 — What We Built & Stabilized (14 merged PRs)

### Foundation & CI (PRs #1–#2)
- Established release validation framework and batch execution process
- Added automated TypeScript + Next.js build checks on every PR

### Demo Stabilization — Batches 1–3 (PRs #3–#5, #8)
- **Batch 1:** Fixed role-based landing (doctors to waiting room, nurses to patient list), closed demo-critical release gates
- **Batch 2:** Repaired patient routing and visit-history continuity — eliminated hydration mismatches, fixed broken navigation CTAs, deterministic date rendering
- **Batch 3:** Stabilized waiting-room handoff (Assign To Me now works end-to-end) and visit persistence (save -> history -> reopen -> finalize/sign proven locally)
- **Roll-up PR #8** brought all three batches cleanly onto `main`

### Bug Fixes & Hardening (PRs #6, #9–#13)
- Fixed past-medical-history crashes, raw status labels, Log New Visit button (PR #6)
- Refactored storage bucket config, eliminated document duplication (PR #9)
- Fixed patient overview rendering for legacy data shapes and counts (PR #10)
- Hardened visit details for legacy note JSON content (PR #11)
- Added router refresh for patient-detail mutations so edits reflect immediately (PR #12)
- Refined patient/waiting-room/visit-history page-level presentation (PR #13)

### AI & Voice Intake (PR #14)
- **Browser-first live speech recognition** — no file upload needed; clinician speaks and transcript streams in real-time
- **AI patient voice intake** — nurse/front-desk speaks patient demographics, AI parses and pre-fills the create-patient form
- **AI prefill confirmation gate** — clinician reviews AI-suggested fields before submit
- Fixed patient ID alignment between consent signature storage and DB record
- Fixed stale-transcript race condition when stopping voice capture

---

## Slide 3 — April 3 Walkthrough Feedback (Dr. Rabkin)

The April 3 live walkthrough confirmed **core workflows function smoothly**. Direct quote: *"The system appears to be working smoothly with no major errors, only minor changes needed to better reflect a clinic setting."*

**What worked well:**
- Patient creation and waiting room flow
- Patient data autosaving (history, social, etc.)
- AI captured simulated visit details accurately
- Overall system stability — no crashes or major errors

**What needs refinement (from meeting):**

| Feedback Item | Priority | Status |
|---|---|---|
| AI note should be **narrative format**, not just structured fields | High | Not started |
| **Speed up** AI processing time | High | Improved (browser-first approach eliminates upload latency) |
| Auto-input **date** into notes | Medium | Not started |
| Integrate **ICD-10 code picker** for diagnoses | High | Partial (AI extracts codes; no searchable picker yet) |
| **Previous visits** as pop-up, not full navigation away from active note | High | Not started |
| **Physician search** across all patients | Medium | Partial (nurses can search; doctors need equivalent) |
| **Inbox** for tasks, messages, lab results, refill requests | High | Not started |
| AI should **auto-place orders** (meds, labs, imaging) | Medium | Partial (orders section exists; no auto-placement) |
| **Print** option for prescriptions | Medium | Not started |
| Nurse view: show **daily schedule** instead of all-patient history | High | Not started |
| Nurse order input with physician co-sign | Medium | Not started |
| Change nurse sign-off to **"Hand Off"** terminology | Low | Not started |
| Stop nurse input screen when doctor clicks Assign To Me | Medium | Not started |
| **"Patient done/leaving"** option beyond save or send-to-waiting-room | Medium | Not started |
| Enable **telehealth** for demo | High | Exists (Twilio video is live) |

---

## Slide 4 — What's Next (Prioritized Roadmap)

### Immediate (Pre-Demo)
1. **Narrative note format** — AI output as readable clinical narrative, not just field-value pairs
2. **ICD-10 code picker** — searchable diagnosis database linked to chronic condition tracking
3. **Visit history pop-up** — overlay previous visits without leaving the active note
4. **Nurse daily schedule view** — replace the all-patient list with today's queue
5. **Telehealth demo prep** — verify Twilio video end-to-end on staging

### Short-Term (Post-Demo Sprint)
6. **Physician inbox** — tasks, nursing messages, lab results, refill requests
7. **Full physician search** — search any patient from the doctor's view
8. **Auto-order placement** — AI suggests and slots medications/labs/imaging into orders
9. **Print prescriptions** — PDF generation and browser print for scripts
10. **Nurse pre-orders with co-sign** — nurse enters orders pending physician approval

### Polish
11. Auto-date in notes
12. "Hand Off" terminology for nurse sign-off
13. "Patient Done" discharge flow
14. Suppress nurse screen on Assign To Me

---

## Slide 5 — 5-Minute Demo Walkthrough

> **Recommended flow for a live 5-minute presentation.** Each step maps to a confirmed working path.

### Setup (before presenting)
- Two browser tabs ready: one as **Doctor**, one as **Nurse**
- Pre-seeded patient in the system (or create one live)
- Credentials: `demodoctor@telehealth.com` / `demonurse@telehealth.com`

### The Flow (~5 min)

| Step | Who | Route | What to Show | Time |
|---|---|---|---|---|
| **1. Nurse logs in** | Nurse | `/patients` | Patient list, search, responsive layout | 0:00–0:30 |
| **2. Create patient** | Nurse | `/patients/new` | *Optional:* demo AI voice intake — speak patient info, show AI pre-fill, confirm | 0:30–1:30 |
| **3. Consent & send to waiting room** | Nurse | Consent dialog -> Waiting room | Signature capture, triage level, appointment type selection | 1:30–2:00 |
| **4. Doctor picks up patient** | Doctor | `/waiting-room` | Show queue with patient, click **Assign To Me**, navigates into visit | 2:00–2:30 |
| **5. AI-assisted clinical note** | Doctor | `/patients/[id]/new-visit` | Start **AI Capture** (live speech), speak visit narrative (chief complaint, HPI, vitals, exam, assessment/plan), watch transcript stream in real-time | 2:30–3:30 |
| **6. Review & save** | Doctor | Same | Review AI-parsed sections, edit if needed, click **Save Visit** | 3:30–4:00 |
| **7. Visit history & sign** | Doctor | `/patients/[id]/visit-history/[visitId]` | Open saved visit from history, show persisted content, click **Sign Note** — shows "Signed & Complete" | 4:00–4:30 |
| **8. Telehealth (bonus)** | Doctor | `/waiting-room` -> virtual visit | If time permits: show virtual appointment flow, Twilio video connect | 4:30–5:00 |

### Demo Guardrails
- Use **separate browser profiles** for doctor and nurse (avoids session conflicts)
- If AI capture is slow, narrate: *"In production this streams in real-time; we're using a shared API key"*
- If Twilio is flaky, skip step 8 and close with the signed note as the final state
- Avoid rapid tab-switching on the same account

---

## Slide 6 — Team & Contributions

| Contributor | Role | Key Contributions |
|---|---|---|
| **Kejhawn Brown** (Khrollo) | Lead / Architecture | Release stabilization (Batches 1–3), CI/CD setup, PR review & merge management, branch strategy |
| **Tenoy Wilson** (Tenoywil) | Feature Development | Browser-first AI capture, patient voice intake, storage refactor, visit rendering hardening, patient detail refresh |
| **JayDbb** (bymrbanks) | Bug Fixes / UI | P0/P1 bug fixes (PMH crashes, status labels), UI component refactoring |

**Tech Stack:** Next.js 16 (App Router) / React / TypeScript / Tailwind CSS / shadcn/ui / Supabase (Auth + DB + Storage) / Drizzle ORM / Twilio Video / OpenRouter AI / Vercel

---

## Slide 7 — Summary

**Where we are:** The core clinical workflow — patient intake, waiting room, visit documentation with AI capture, save/sign, and telehealth — is **functional and stable**. 14 PRs merged since April 1 addressing stability, routing, persistence, and AI capabilities.

**What the walkthrough confirmed:** The system works end-to-end for the urgent-care model. No major errors. Ready for demo with guardrails.

**What's ahead:** Narrative note formatting, ICD-10 integration, visit history overlay, physician inbox, nurse scheduling view, and print capabilities are the primary items before a clinical-ready release.

**Next milestone:** Implement the high-priority feedback items from the April 3 walkthrough, then schedule the follow-up review with Dr. Rabkin and Trudy.
