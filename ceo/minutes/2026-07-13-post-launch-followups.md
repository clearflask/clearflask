# Minutes — 2026-07-13 — Post-launch follow-ups (README button, kickback facts, outreach refresh)

Present: CEO (Claude); board opened with "whats next?" — treated as go-ahead on
the queued post-launch follow-ups from 2026-07-08.

## Work done

1. **README "Deploy on Railway" button** — new "One-click deploy" section at the
   top of Self Hosting (+ Contents entry) linking
   https://railway.com/deploy/clearflask with a one-line pitch (self-contained
   stack, works on the generated domain). Committed to master.

2. **Kickback program investigated** (docs.railway.com/templates/kickbacks,
   /templates/partners, railway.com/open-source-kickback, railway.com/partners):
   - The **50% OSS promo is OVER** — it was a limited-time launch offer. Nothing
     to enroll in; follow-up closed.
   - Live program: **15% base + 10% support bonus = 25% max.** Automatic for
     published templates. The +10% is earned by answering user questions in the
     Template Queue (station.railway.com/my-template-queue) — no sign-up, just
     answer as questions arrive. Per posting rules, CEO drafts answers for board
     review before posting (or board grants standing approval for template
     support answers).
   - Payouts accrue as Railway credits by default; cash opt-out on the Earnings
     page (withdrawals $100–$10,000, ~10 business days).
   - NEW: **Open Source Partner program** (railway.com/partners) — Verified
     badge + featured placement, same rates, application form ("Become a
     partner"). BOARD ASK filed; suggested answers in `specs/railway-template.md`.

3. **Outreach drafts refreshed** (`outreach/`): both previously described the
   old 4-container localstack stack. New 2026-07-13 drafts pitch the lean
   3-container platform stack, single-tenant mode, ~1 GB footprint, and the live
   Railway listing as proof.
   - PikaPods: follow-up draft (original sent 07-03, no reply; follow-up was due
     ~07-10) to hello@pikapods.com.
   - Elestio: updated full draft for support@elest.io (kaiwalya@ bounced 07-03);
     now references docker-compose.platform.yml.
   - BOARD: review + send both.

## P2 kicked off (later in session)

Ran the codebase audit and drafted the spec (`specs/ai-dedupe-digest.md`).
Findings that reshape the estimate: **post merging is fully built** (API, data
model, admin merge UI — not the broken TODO the backlog assumed), **lexical
similar-posts already suggests duplicates at post-create**, and **a weekly
digest cron already runs** (WeeklyDigestService + OnDigest email + plan
gating). LLM plumbing (LangChain4j/OpenAI, hot-reloadable config, global API
key) exists from the AI-chat feature. No embedding infra — v1 spec therefore
uses LLM-reranked lexical candidates, no vector DB. Net-new: duplicate-rerank
store + admin "suggested merges" endpoint/UI + AI sections in the existing
digest + plan-gate the (currently ungated) AI chat. Estimated a few sessions,
no new infra or schema.

## Next (CEO)

- Monitor Template Queue + listing analytics on future sessions.
- On spec approval: implement P2 per the build plan.

## Action items

- [x] CEO: README Deploy-on-Railway button — DONE (committed).
- [x] CEO: OSS promo / Template Queue investigation — DONE (promo over; queue
      answers are the whole bonus).
- [ ] BOARD: send PikaPods follow-up (hello@pikapods.com) — draft in
      `outreach/pikapods-draft.md`.
- [ ] BOARD: send Elestio email (support@elest.io) — draft in
      `outreach/elestio-draft.md`.
- [ ] BOARD: submit Railway Open Source Partner application
      (railway.com/partners) — suggested answers in `specs/railway-template.md`.
- [x] CEO: P2 spec (AI dedupe + weekly digest) — DRAFTED, see above.
- [ ] BOARD: review `specs/ai-dedupe-digest.md` (gating question inside).
