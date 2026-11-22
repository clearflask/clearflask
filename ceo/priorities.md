# Priorities — Working Backlog

_Last updated: 2026-11-21. Statuses: TODO / IN PROGRESS / BLOCKED(on) / DONE.
Finished history lives in `board-log.md` and `minutes/`; this file keeps only what
is still open plus one-line DONE markers where they explain current state._

## P0 — Ship what is already built (review queue)
Four pieces of finished work are waiting on the board, not on engineering.
- [ ] **Admin email verification** (branch `feat/admin-email-verification-review`,
      uncommitted; plan `plans/admin-email-verification.md` on that branch).
      Browser walkthrough done in all three modes: *mandatory* returns 403 on
      protected admin APIs until verified; *optional* shows a notice and lets the
      user continue; *off* sends nothing and offers manual verify. Switching an
      existing account from off to mandatory did not lock it out. Not yet walked
      through: invitation flows. BLOCKED(board: review screenshots, then merge).
- [ ] **Localhost session cookie fix** — on local master (`2db32b46`), not pushed.
      On plain-HTTP localhost / IP-address hosts the session cookie was deleted in
      the same response that set it, so sign-in was lost on reload. Affects some
      self-host setups, not clearflask.com. Regression test included. TODO: push
      (CI validates), then include in the next patch release.
- [ ] **Slack + Jira fixes** (branch `worktree-agent-ad0182cc63e4a7152`, not merged):
      fixed an authorization flaw in Slack workspace linking; added the missing
      Slack notification for admin-created comments; fixed Jira token lifecycle
      (sync stopped about an hour after linking; now requests offline access and
      rotates refresh tokens). Existing Jira customers must re-link once after
      deploy. BLOCKED(board: approve deploy + re-link notice).
- [ ] **Distribution batch** (branch `worktree-agent-a9057785feca03888`, not merged):
      marketing `sitemap.xml` + robots `Sitemap:` line; Featurebase, Frill and
      Released alternative pages (vendor prices verified 2026-11-21); pricing-page
      line "Flat pricing with no tracked-user meter." BLOCKED(board: the two copy
      questions in P3).

## P1 — Activation v1 (ahead of all AI work)
Status: SPEC READY — BLOCKED(board sign-off). `specs/activation.md`.
Boards die of silence (`reports/churn-post-mortem-2026-08-29.md`), and AI only
helps a board that already has traffic. Sharpest finding: **an owner gets no email
when a real user posts** — the first post passes in silence. The first-run
checklist exists but renders at the bottom of the home page, under empty charts,
with the "start collecting feedback" steps last.
- [ ] BOARD: answer the spec's open questions (sequence, activation bar, read-only
      baseline scan, email volume, trial email, plan gating on GitHub/API).
- [ ] v1 (~4 sessions, no new infrastructure): owner alert on the first five
      external posts; checklist moved to the top and reordered, with import and
      "post on behalf" surfaced; day-3/day-7 rescue emails plus one quiet-board
      email per four weeks; measurement fields + baseline report.
- [ ] 60-day read; if cohorts are not visibly above baseline, stop and move to
      ingestion.

## P2 — Integrations (audited 2026-11-21)
The old "Finish Slack" / "Jira next" items were stale: Slack, Jira, GitLab and
GitHub are all built and have production credentials configured.
- Honest publishable count: **5** — API, Google Analytics, Hotjar, Intercom
  Messenger, GitHub. **Beta:** Slack, Jira. Marketing copy should match this.
- [ ] Merge + deploy the Slack/Jira fixes (P0).
- [ ] Jira: refresh webhooks before their 30-day expiry (missing today; links go
      quiet after a month).
- [ ] GitLab: outbound sync (ClearFlask → GitLab) is not wired; inbound works.
      October minutes recorded GitLab disabled pending credential maintenance, but
      production config now has it enabled. BOARD: confirm the maintenance was
      completed. Not listed as an integration until both are settled.
- [ ] Outbound webhooks exist but default off with no admin UI. Small UI would make
      them a real integration point.
- [ ] Zapier is claimed in copy but not built — remove the claim (or build it
      later on top of webhooks).

## P3 — Distribution
Status: IN PROGRESS.
- [x] DONE: Railway template live (2026-07-08); README deploy button; Canny /
      UserVoice / Fider alternative pages (2026-08-29).
- [ ] Merge the distribution batch (P0) once two copy questions are answered:
      (a) confirm `releasedhub.com` is the same company as `released.so`;
      (b) the public pricing page sells only Cloud $29 and Self-host $9, while the
      comparison/alternative pages cite a $6 entry plan and a "free plan" that does
      not appear to be on sale. Fix the copy to match whatever the board decides
      in P4.
- [ ] BOARD: PikaPods app request + Elestio email (drafts in `outreach/`, open since
      July); Railway Open Source Partner form (answers in `specs/railway-template.md`).
- [ ] BOARD: G2 + Capterra listings (account signup); Google Search Console.
- [ ] UserJot alternative page (pricing not yet verified).
- [ ] Canny per-user overage past each tier is unpublished; verify or drop the
      extrapolation on the compare page.
- [ ] DO Marketplace image; Umbrel/CasaOS PRs (lean platform stack makes them cheap).
- [ ] Monitor Railway Template Queue (answers earn the support bonus; drafts for
      board review).

## P4 — Pricing
Status: TODO — partly informed, still BLOCKED(board: Stripe MRR + churn).
- Account-record read (2026-11-21; Stripe itself not read): very few accounts are
  in an active paid monthly state; the $6 Cloud Starter tier has no active
  subscribers; most active accounts are on lifetime or grandfathered plans. Every
  churned custom-domain board in the post-mortem was on a plan reachable from the
  cheap tiers.
- [ ] BOARD: Stripe MRR + churn timeline — still the biggest blind spot; account
      records give state, not dollars or dates.
- [ ] BOARD: retire Cloud Starter? The account read removes the main argument for
      keeping it. Decide together with the free-plan question in P3.
- [ ] **Signup drop:** signups fell to roughly a quarter of the earlier monthly rate
      in October and November, coinciding with the fake-signup cleanup and the
      registration CAPTCHA rollout. Find out whether CAPTCHA (or any other October
      change) is turning away real users before reading anything into pricing.
- [ ] Lead with "no tracked-user meter" (pricing-page line is in the P0 batch).
- [ ] Target shape: Free (1 project, branded) → ~$29 → ~$99 (SSO/whitelabel/AI);
      define the self-host open-core boundary; board approves before any Stripe
      catalogue change.

## P5 — Trust, security, operations
Re-verified against the code 2026-11-21.
- [x] DONE (dropped): CSS injection in `AppThemeProvider.tsx` — font family is
      sanitized (`2feea4ee`); remaining custom CSS is an intended admin feature.
- [x] DONE (dropped): cookie flags — `AuthCookieImpl` sets HttpOnly, SameSite,
      Secure and the `__Host-` prefix on secure deployments.
- [x] DONE (dropped): comment replies — `CommentList.tsx` renders replies and a
      reply box; the old TODO is gone.
- [x] DONE (dropped): JMX — not enabled in the server image; only the local dev
      compose turns it on.
- [x] DONE: October security response (AI authorization, registration CAPTCHA,
      OAuth destination binding, superadmin abuse controls), releases 2.7.1–2.7.3;
      invitation acceptance bound to the intended email (2.7.3).
- [ ] Production Connect runs an end-of-life Node.js release (the image already uses
      Node 20). Plan the host upgrade.
- [ ] Bump EOL image pins in the compose files: localstack 0.14.3, mariadb 10.5,
      Elasticsearch 7.10.0.
- [ ] Self-host telemetry still defaults on; it is documented with a working opt-out.
      Decide: keep (documented) or default off.
- [ ] Connect worker memory leak: protections hold (workers 270–430 MB of an 816 MB
      cap; ~1 GB free on the host), root cause not found. The box has little
      headroom; a larger instance costs money (board).

## P6 — AI dedupe + digest (after activation)
Status: SPEC NEEDS RE-AIM — BLOCKED(board sign-off). `specs/ai-dedupe-digest.md`.
Canny gives AI dedupe away on every tier, so do not gate dedupe; keep the digest
half; move the headline to ingestion (support conversations → feedback). Revisit
after activation v1's 60-day read.

## Explicitly NOT doing (unless it feeds the above)
- React 18 / MUI 5 / Webpack 5 / Java 17 migrations.
- New storage backends, KillBill cleanup beyond what Stripe work requires.
