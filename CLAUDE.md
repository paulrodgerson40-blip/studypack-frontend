# StudyPack.ai — System Architecture
Last updated: May 16, 2026

## Services
| Service | Role | Status |
|---------|------|--------|
| Vercel | Frontend hosting (Next.js App Router) | Live |
| DigitalOcean VPS `170.64.209.149` | FastAPI backend, PDF rendering | Live |
| DigitalOcean Spaces `studypack-storage.syd1` | File storage (pack.json, PDFs) | Live |
| Clerk | Auth — sign up/in, webhooks to Supabase | Live |
| Supabase `ljtxatzjnmvmhykaeyeq` | PostgreSQL database | Live |
| Stripe | Credit purchases, webhooks | Live |
| OpenAI | gpt-4.1-mini (Stage 1) + gpt-5.4 (Stage 2) | Live |
| Google Cloud Translation | Pack translation, 17 languages | Live |
| Resend | Welcome, purchase confirmation, contact, feedback emails | Live |
| GitHub `paulrodgerson40-blip/studypack-frontend` | Frontend source, auto-deploys | Live |

## Key API routes
- `POST /api/translate` — translate pack (deducts credit, calls Google, renders PDF)
- `GET /api/translate?job_id=` — list translations for a job
- `GET /api/translate/download?id=` — signed PDF download
- `GET /api/studypack/download/[jobid]` — English PDF with clean filename
- `PATCH /api/subjects/[id]` — update total_weeks (floor-protected)
- `POST /api/webhooks/clerk` — user.created → Supabase + welcome email
- `POST /api/webhooks/stripe` — checkout → credits + confirmation email

## Database tables
- `user_profiles` — clerk_user_id, credits
- `subjects` — user_id, name, code, university, total_weeks, completed_weeks
- `weekly_packs` — subject_id, week_number, job_id, master_pdf_path, status
- `translations` — user_id, job_id, target_language, status, translated_json_path, translated_pdf_path
- `credit_transactions` — user_id, type, credits, stripe_session_id

## Spaces structure
- `packs/{job_id}/pack.json` — original pack content
- `packs/{job_id}/pack_{lang}.json` — translated JSON
- `packs/{job_id}/pack_{lang}.pdf` — translated PDF
All files private ACL, served via signed URLs.

## VPS backend
- Root: `/root/studypack/`, Port: 8002
- `systemctl status studypack` / `restart` / `journalctl -u studypack -f`

## Credit model
- 1 credit = 1 generation or 1 translation
- Re-downloading same translation = free
- Translation auto-refunds on failure
- Generation does NOT auto-refund on failure (known issue)

## PDF filenames
- `StudyPack-LAW300_Week1-Premium.pdf`
- `StudyPack-LAW300_Week1-Premium-Korean.pdf`

## Translation rate limit
- Max 10 translations per hour per user

## Known issues
- Credits not refunded on generation backend crash
- Backend not in GitHub (disaster risk)
- No Sentry/error monitoring
- No uptime monitoring
