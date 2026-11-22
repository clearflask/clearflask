# Minutes — 2026-11-21 — Review and plan

Present: board (Matus), CEO (Claude).

## Agenda and decision
The CEO proposed: finish admin email verification, close incident loose ends,
refresh the cabinet, re-audit integrations, take small distribution wins,
consolidate board asks, and put activation before AI. Board: "do it all."

**DECISION:** activation work ranks ahead of all AI work.

## Since the last update (2026-10-31, 2.7.2)
- 2026-11-14: invitation acceptance bound to the intended email; deployed to the
  SaaS and released as 2.7.3.
- 2026-11-15: integration-test fixtures updated for registration CAPTCHA; master CI
  green again.

## Work done this session
- **Admin email verification** (feature branch, uncommitted). Local browser
  walkthrough in all three modes, with screenshots: mandatory blocks protected
  admin APIs with 403 until verified; optional shows a notice and lets the user
  continue; off sends no email and offers manual verify. An existing account
  switched from off to mandatory was not locked out. Invitation flows were not
  walked through. Bugs found and fixed:
  - Session cookie deleted in the same response that set it on plain-HTTP
    localhost / IP-address hosts, losing sign-in on reload. Affects some self-host
    setups, not clearflask.com. Fixed on master (`2db32b46`) with a regression test.
  - Optional-mode notice rendered inside the narrow side menu. Fixed on the branch.
- **Integrations audit.** Slack, Jira, GitLab and GitHub are built and configured
  in production. Publishable today: API, Google Analytics, Hotjar, Intercom
  Messenger, GitHub; Slack and Jira in beta. GitLab outbound sync is not wired.
  October minutes recorded GitLab disabled pending credential maintenance, while
  production config now has it enabled; whether that maintenance happened is a
  board question. Outbound webhooks exist, default off, no UI. Zapier is claimed in
  copy but not built.
- **Slack/Jira fixes** (branch, not merged): authorization flaw in Slack workspace
  linking fixed; Slack hook for admin-created comments added; Jira token lifecycle
  fixed (offline access, refresh-token rotation). Jira customers re-link once after
  deploy. Jira 30-day webhook refresh still missing.
- **Distribution** (branch, not merged): marketing sitemap and robots `Sitemap:`
  line; Featurebase, Frill and Released alternative pages with prices verified on
  the vendor sites today; pricing-page line "Flat pricing with no tracked-user
  meter."
- **Activation spec** written: `specs/activation.md`. Owners get no email when a
  real user posts; the first-run checklist exists but sits at the bottom of the
  home page.
- **Revenue read** from account records (Stripe not read): very few accounts in an
  active paid monthly state; no active Cloud Starter subscribers; most active
  accounts on lifetime or grandfathered plans. Signups dropped to roughly a quarter
  of the earlier monthly rate in October and November, coinciding with the
  fake-signup cleanup and registration CAPTCHA.
- **Production health:** up, health ok; Connect memory protections working; about
  1 GB memory free. Production Connect runs an end-of-life Node.js release. The
  temporary incident probe watcher is no longer on the host (expired as designed).
- **Housekeeping:** pruned 7 dead worktrees; deleted 10 merged local branches.
- **Cabinet:** `priorities.md` rewritten; old trust items re-verified against code
  (CSS injection, cookie flags, comment replies and JMX were already fixed and were
  dropped).

## Action items
Board:
1. Review email-verification screenshots; approve merge.
2. Approve Slack/Jira deploy with a Jira re-link notice.
3. Confirm Released identity; decide the $6 / free-plan copy.
4. Confirm GitLab credential maintenance status.
5. Approve the signup-drop investigation.
6. Sign off activation v1 and answer the spec's questions.
7. Still open: PikaPods / Elestio / Railway partner submissions; G2, Capterra,
   Search Console; Stripe MRR + churn; Cloud Starter decision; AI spec re-aim;
   win-back note.

CEO:
- Walk through invitation flows under each verification mode before merge.
- On approval: merge and deploy the review queue (P0 in `priorities.md`).
- Investigate the signup drop.
- Start activation v1 once signed off.
