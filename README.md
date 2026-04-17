# Tele-Medical

Tele-Medical is a clinician-facing telehealth application built for role-based care delivery across doctor, nurse, and admin workflows. The current product focuses on the core visit lifecycle: authentication, schedule and waiting room triage, patient chart review, active visit documentation, orders and actions, note management, and irreversible sign-off.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS and shadcn/ui
- Supabase auth and platform services
- Drizzle ORM
- Better Auth for application auth flows
- Dexie-based offline draft and outbox support

## Getting Started

Run the development server:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Workflow Overview

The primary clinician journey is:

1. Sign in
2. Review the waiting room / schedule
3. Open the patient chart
4. Complete the active visit note
5. Place labs, imaging, prescriptions, referrals, and follow-up steps
6. Review coding and sign the visit

Supporting screens also include open notes, admin user management, patient vitals history, labs and results, and role-aware navigation.

## Recent Clinical Workflow Updates

Recent changes in this branch deepen the end-to-end visit workflow without changing auth, offline sync, or the AI transcription pipeline:

- Google OAuth is wired in as the primary sign-in path, with email/password retained as fallback.
- Waiting room rows now expose richer schedule context, day navigation, urgent alert acknowledgement, and quick patient snapshot access.
- Global command search uses clinician-friendly groups for patients, notes, and schedules.
- Patient chart navigation includes a dedicated labs and results view.
- The active visit form now includes expanded note structure for ROS, differential diagnoses, visit actions, coding prep, nurse intake review, mini schedule access, and objective abnormal-vital flags.
- Visit actions are structured for prescriptions, labs, imaging, referrals, and next steps rather than plain free-text entry.
- The vitals tab now includes a multi-series progression chart with abnormal markers and date filtering.
- Doctors can complete visit close from a dedicated sign-off screen with ICD-10 and CPT review, attestation, co-sign request flow, and validation before close-out.
- Open notes now distinguish open, closed, and all notes more clearly.
- Admin users have role-aware landing and navigation support, including user provisioning access.

## Verification

The current working changes were verified locally with:

```bash
npx tsc --noEmit
npm exec eslint -- "app/(app)/patients/[id]/vitals/vitals-content.tsx" "app/_components/visit/new-visit-form.tsx" "app/_components/visit/visit-close-content.tsx" "app/_actions/users.ts" "app/_lib/visit-note/schema.ts" "app/api/visits/[visitId]/cosign-request/route.ts"
```

## Deployment

Production deploys are managed through Vercel. The active production domain currently remains the existing Vercel-hosted domain until custom-domain ownership changes are completed.
