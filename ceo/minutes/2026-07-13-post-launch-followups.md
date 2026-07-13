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

## Next (CEO)

- Start the **P2 spec: AI duplicate detection + weekly feedback digest** — the
  relaunch story ("open-source Canny alternative with AI triage"); Product
  Hunt / Show HN drafts to follow for board review.
- Monitor Template Queue + listing analytics on future sessions.

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
- [ ] CEO: P2 spec (AI dedupe + weekly digest).
