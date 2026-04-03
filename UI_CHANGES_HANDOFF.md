# UI Changes Handoff — Carlton Gordon Issues

**Owner:** Carlton Gordon
**Deadline:** Thursday, April 2, 2026
**Source:** Atlas Telemedicine Platform Operating Document (March 31 Working Meeting)

---

## P2 Issues (6 items)

### 1. Search Bar Placement
**Screen:** Visit Log (`/patients/[id]/visit-history`)
**File:** `app/_components/patient-chart/patient-chart-shell.tsx`

**Current:** The patient search bar is positioned above the new visit area in the top bar, making the layout feel disjointed.

**Expected:** Search should live inside the side navigation panel for contextual clarity, not floating above the main content area.

---

### 2. Remove "Save Visit" Button
**Screen:** Visit Log / New Visit (`/patients/[id]/new-visit`)
**File:** `app/_components/visit/new-visit-form.tsx`

**Current:** A "Save Visit" button exists on the visit screen, implying the user must manually save. This is inconsistent with the expected autosave behavior.

**Expected:** Data should autosave as the clinician works. Remove the manual "Save Visit" button to avoid confusion about whether data is being saved automatically.

---

### 3. AI Capture Button Placement
**Screen:** Visit / Note Entry (`/patients/[id]/new-visit`)
**File:** `app/_components/visit/new-visit-form.tsx`, `app/_components/visit/ai-capture-panel.tsx`

**Current:** The AI audio capture button is placed in an inconspicuous position where it is likely to be overlooked. This is the primary interaction point for the app's core feature.

**Expected:** AI capture button should be placed prominently — either large and bold at the top of the page, or anchored to the bottom as a persistent action button. It should be immediately visible when a clinician opens a visit.

---

### 4. Sidebar Navigation Hierarchy
**Screen:** Main Navigation / Sidebar
**File:** `components/side-nav.tsx`

**Current:** The sidebar contains Waiting Room, New Patient, and Open Notes as flat, peer-level top items. This does not reflect an appropriate page hierarchy.

**Expected:** Restructure navigation with a patient-first hierarchy. The primary view should be a **Patients** screen, with contextual sections (e.g. today's schedule, waiting room) surfaced from there. Consider:
- `Patients` as the main nav item
- `Waiting Room` as a contextual sub-view or filter within patients
- `Open Notes` as a secondary action
- `New Patient` moved out of the sidebar (see item #5)

---

### 5. Move "New Patient" Action to Main Page
**Screen:** Navigation / Patient View (`/patients`)
**File:** `components/side-nav.tsx`, `app/(app)/patients/page.tsx`

**Current:** "New Patient" is buried as a sidebar nav item, separated from the patient list view.

**Expected:** Surface an "Add Patient" action button prominently on the main patients page (e.g. top-right corner next to the page title). Remove it from the sidebar.

---

### 6. Unified Patient Dashboard View
**Screen:** Patient Profile / Note Entry (`/patients/[id]/new-visit`)
**File:** `app/_components/visit/new-visit-form.tsx`

**Current:** When entering or continuing a visit note, the clinician cannot see both the note entry fields and the patient's existing data (vitals, history) at the same time. These exist in completely separate UI contexts, requiring the clinician to switch between views.

**Expected:** Provide a unified dashboard layout — allowing the clinician to enter new information while seeing relevant historical context side by side. Consider a split-pane or collapsible reference panel showing previous vitals, history, and medications alongside the note entry form.

---

## P3 Issues (1 item)

### 7. Input Fields Lack Proper Spacing
**Screen:** General / Multiple Screens (Login, Patient Profile, Visit Note)
**Files:** Various — audit across key screens

**Current:** Input fields across various screens lack adequate spacing, appearing cramped with insufficient gaps between them.

**Expected:** Input fields should have consistent, comfortable spacing in line with the design spec. Audit and standardize vertical spacing between form fields across:
- Sign-in form
- Patient profile / personal details
- Visit note entry form
- Any modal forms (add condition, add allergy, etc.)

---

## Architecture Notes

- **Framework:** Next.js 16 (App Router) + React 19 + Tailwind CSS + shadcn/ui (Radix)
- **Sidebar component:** `components/side-nav.tsx` — handles both global nav and patient medical sections
- **Patient chart layout:** `app/_components/patient-chart/patient-chart-shell.tsx` — wraps all `/patients/[id]/*` routes
- **Visit form:** `app/_components/visit/new-visit-form.tsx` — large client component with section stepper, AI capture, offline support
- **AI capture:** `app/_components/visit/ai-capture-panel.tsx` — voice transcription panel
- **Medical info panel:** `app/_components/visit/medical-info-panel.tsx` — existing side drawer for viewing patient data during visits (currently triggered via sidebar buttons on the new-visit page)
