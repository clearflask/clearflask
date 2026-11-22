# Spec — Activation: first feedback for new boards, rescue for quiet ones

_Status: DRAFT 2026-11-21, for board review. Codebase audit done the same day; no
code written and nothing run against production. Statements about existing code
carry a path; anything not read directly is marked **(inferred)**._

## 1. Problem

Boards die of silence, not of competition. The churn post-mortem
(`reports/churn-post-mortem-2026-08-29.md`) checked 12 dead custom domains: one
moved to another vendor, one was not churn, and ten simply stopped running a
feedback board. Nine never repointed DNS. The pattern is a small team that stands
up a board, gets little on it, stops logging in, and lets the plan lapse. AI
dedupe and summaries (`specs/ai-dedupe-digest.md`) only help a board that already
has traffic, so this spec comes first: get a new board its first real feedback,
and pull the owner of a quiet board back. Support time is the scarce resource, so
everything here is self-serve, uses existing plumbing, and needs no new
infrastructure.

## 2. What the code does today

**New-account path.** Signup redirects a new account to `/dashboard/welcome`
(`site/AccountEnterPage.tsx`), which renders the create wizard
(`site/dashboard/CreatePage.tsx`): scenario → feedback layout → project details →
create → an "invite teammates" step → dashboard home. The wizard builds config
only; it creates no posts. The welcome email (`core/push/message/OnAccountSignup.java`,
sent from `AccountResource.java:675`) goes out at signup, before a project exists,
with three generic tips and a link to `/dashboard`.

**Empty dashboard.** `site/dashboard/DashboardHome.tsx` shows four 7-day
histograms, workflow previews, and Trending / Recent users / Randomized lists —
all empty on a new board. A **first-run checklist already exists**: `TourChecklist`
(`common/tour.tsx`) with ten guides defined in `common/ClearFlaskTourProvider.tsx`.
Three things blunt it:

- It renders last on the page (`DashboardHome.tsx:357`), below the empty charts.
- Its groups are ordered "manage feedback" → "customize your portal" → "start
  collecting feedback". The step that decides survival is last, and consists of
  invite teammates, install, and add a payment card.
- Completion is self-reported walkthrough state stored in account attrs
  (`guide-state-*`), per account rather than per project, and never checked
  against real data. The file carries a `TODO: Import data, Invite teammates`.

**Getting feedback in.** Settings → Install (`ProjectSettingsInstall` in
`site/dashboard/ProjectSettings.tsx`) offers a plain `<a>` link, an `<iframe>`
widget (optionally in a popup), and a status embed. There is no JavaScript loader,
so we get no signal that an embed was installed. There is no share action on the
dashboard home beyond the "Visit" button.

**Most likely stall point (inferred from the above):** the owner finishes the
wizard, lands on a page of empty charts, and the two actions that would produce
feedback — put the link in front of users, or load in what they already have —
are two levels down in Settings. Nothing afterwards tells them the board is empty.

**Mechanisms that could drive engagement, and their state.**

| Mechanism | State | Where |
|---|---|---|
| Weekly digest | Runs daily, sends once per ISO week. **Skips a project with no new posts and no notifications, and skips the account if no project qualifies** — a quiet board gets no email at all. Only `ACTIVE`/`ACTIVETRIAL` accounts. | `core/email/WeeklyDigestService.java` |
| Owner alert on a new post | **None.** `IdeaResource.ideaCreate` (`:91`) fires webhook, Slack and Jira hooks only. `onPostCreated` notifies category subscribers and is called only from admin-create and the GitHub/GitLab sync. An owner learns of a first post the following Monday, or never if they opted out. The welcome email tells them to "turn on email notifications so you don't miss important feedback"; I found no such setting for new posts. | `web/resource/IdeaResource.java`, `core/push/NotificationServiceImpl.java` |
| CSV import | Built: upload, column mapping, title/description/status/tags/votes/date. Lives under Settings → Data; not in the checklist. | `common/config/settings/DataSettings.tsx`, `ProjectResource.projectImportPostAdmin` |
| Post on behalf of a user | Built: admin create takes an author; the author is emailed. | `IdeaResource.ideaCreateAdmin`, `message/OnPostCreatedOnBehalfOf.java` |
| Slack → posts | Built, **off by default** per channel link (`syncSlackToPosts`). | `store/slack/SlackStoreImpl.java` |
| GitHub / GitLab / Jira → posts | Built. GitHub is **blocked on `cloud-free`, `cloud-starter-monthly` and `cloud-monthly`**. | `store/github/GitHubStoreImpl.java`, `billing/CommonPlanVerifyStore.java` |
| API | Built; API key is **blocked on the same three plans**, so do-it-yourself ingestion is closed to the cheap tiers too. | `CommonPlanVerifyStore.verifyActionMeetsPlanRestrictions` |
| Email-in | Does not exist. | — |
| Changelog / category subscriptions | Built (end-user side; needs users first). | `NotificationServiceImpl.onPostCreated` |

**Lifecycle emails today** (`core/push/message/`): welcome at signup; trial ending
(5 days before end, `core/email/TrialEndingReminderService.java`); trial ended;
payment failed / succeeded; project-deletion warning (reminder and deletion both
default off in `ProjectDeletionService.java`); weekly digest. Nothing between
signup and the trial-ending email depends on whether the board has any feedback.
The first email a silent board's owner receives after the welcome is a request to
subscribe.

**Signals for spotting a quiet board.**

| Signal | Available? |
|---|---|
| Post count per project / category | Yes — `IdeaStore.countIdeas` |
| Owner-authored vs external posts | Yes — `IdeaModel.authorIsMod`; `IdeaSearchAdmin.filterAuthorId` + `invertAuthorId` (the digest already uses this) |
| Post / user / comment timestamps | Yes — `IdeaModel.created`, `UserModel.created`, histogram endpoints |
| Votes and comments per post | Yes — `IdeaModel.votersCount`, `commentCount` |
| Project creation date | **No** — `ProjectStore.ProjectModel` has no timestamp. `Account.created` is the proxy for a first project |
| Last admin login | **No** — `AccountSession` stores only an expiry |
| Portal / widget traffic | **No** stored counter found; Tomcat access logs keep 5 days |
| `connect/cert` requests | Custom domains only (`ConnectResource.certGetOrCreateConnect`), logs only |
| Activity hook | `billing.recordUsage(POST/COMMENT/VOTE, …)` is called on every action and is a no-op in `StripeBilling.java:957` — a ready place to hang counters |

## 3. Activation definition and baseline

**Activated:** a project with **at least 3 posts from at least 2 distinct
non-moderator authors within 30 days of creation.** **First signal:** at least 1
such post. **Quiet:** a previously activated project with no external post, comment
or vote in 30 days. "Non-moderator" means `authorIsMod` is not true, which excludes
the owner and teammates.

Known distortions: posts an admin files on behalf of a user count as external
(acceptable — a real user asked); CSV imports land under one chosen author;
Slack/GitHub-synced posts are authored by synthetic users whose moderator flag I
did not verify **(inferred external)**. Report imported and synced posts in a
separate column rather than arguing about them.

**Baseline scan (proposed; not run).** A read-only `@Extern` (JMX) method, the
same pattern as `WeeklyDigestService.processAccountWithCustomRange`:

1. Page through `accountStore.searchAccounts(...)` with no status filter, using the
   cursor loop from `WeeklyDigestService.processAll`.
2. For each `projectId` on the account: `ideaStore.countIdeas(projectId)`, then page
   `ideaStore.searchIdeas(projectId, IdeaSearchAdmin{sortBy: NEW})` +
   `ideaStore.getIdeas` and compute, over posts where `authorIsMod != true`: count,
   distinct `authorUserId`, earliest and latest `created`.
3. Emit one CSV row per project to the log: plan, status, `account.created`, total
   posts, external posts, distinct external authors, first and last external post,
   has custom domain, has Slack/GitHub configured.
4. Rate-limit with the digest's limiter. Do not call `userStore.accountCreateOrGet`
   as the digest does — it creates a user when one is missing, and the scan must
   not write.

Output answers: what share of projects ever activated, median days to first
external post, and how many paying accounts are quiet right now.

## 4. Interventions, ranked

| # | Intervention | What the owner sees | Builds on | Effort | Expected effect | Support risk |
|---|---|---|---|---|---|---|
| 1 | **Owner alert on first external posts** | An email within minutes of each of the first five posts from a real user: title, author, reply link. After five it stops and the digest takes over. | `IdeaResource.ideaCreate`; template pattern in `message/OnPostCreated.java`; unsubscribe page already exists | 0.5–1 session | High. The first post is the moment the product proves itself; today it passes in silence. | Low. Capped, opt-out. |
| 2 | **Checklist rework** | On a board with fewer than three external posts, the checklist moves to the top of the home page and leads with: share your link (copy button), add the link or widget to your site, load what you already have (import / post on behalf), invite a teammate. Items tick from real data where we have it. | `TourChecklist`, `ClearFlaskTourProvider.tsx`, `DashboardHome.tsx` (already fetches category totals), `DataSettings.tsx` | 1 session, frontend only | Medium. Fixes ordering and discoverability; cannot make anyone act. | Low. |
| 3 | **Quiet-board rescue emails** | Day 3 / 7 / 14 after creation while there are zero external posts — one action each (share, install, import). For an activated board with 30 quiet days, one "your board has gone quiet" email, at most once every four weeks. | Scheduler, account paging and rate limiter from `WeeklyDigestService`; send-once flag pattern from `TrialEndingReminderService` (`accountStore.setTrialReminderSent`) | 1.5–2 sessions | Medium for new boards, low-to-medium for established ones. Email is the only channel that reaches an owner who stopped logging in. | Medium. Unsolicited email draws replies and unsubscribes; needs a real unsubscribe link, unlike today's lifecycle templates. |
| 4 | **Surface seeding** | Checklist item "Add the requests you already hear" opening the create form with author selection, and "Import a CSV". | `IdeaResource.ideaCreateAdmin`, `DataSettings.tsx` | Inside #2 | Medium. A board with ten real requests invites a vote; an empty one invites nothing. | Low. Imports count against the 100-post cap on `cloud-free` (`PlanConstants.PLAN_MAX_POSTS`). |
| 5 | **Measurement fields** | Nothing visible. | `ProjectModel`, `Account`, the `recordUsage` hook | 0.5 session | Enables #3 and section 7. | None. |
| 6 | **Ingestion on the plans where churn lives** | Slack → posts offered during Slack setup rather than off by default; GitHub and API available on lower plans. | `SlackStoreImpl`, `CommonPlanVerifyStore` | Hours of code; a pricing decision | Potentially the largest: feedback arrives without anyone visiting the board. Unproven. | Medium. Integrations generate the most support questions. |
| 7 | **Dead-embed detection** | Nothing for the owner; a log line for us when a portal request arrives for a project that no longer exists, with the referring site. | `ProjectResource.configAndUserBindSlug` (already throws 404); Connect has no referer handling today | 0.5 session | Low. One known case; produces win-back leads a human must act on. | Low for the log line. |
| 8 | **Starter posts** | Three editable sample posts created with the project. | Wizard, `ideaCreateAdmin` | 1 session | **Weak.** Fake content on a public board reads as fake; owners who forget to delete it look worse than an empty board. #4 gets the benefit honestly. | Low. |
| 9 | **Email-in** | Forward an email to an address; it becomes a post. | Nothing; needs inbound mail | 2–3 sessions plus new infrastructure | Good fit for the ingestion re-aim, wrong size for v1. | Medium: spam, parsing. |

Notes on the weaker items:

- **Dead embed (#7).** The string `clearflask-feedback-button` cited in the
  post-mortem appears nowhere in this repository, so that markup is the customer's
  own or from an older snippet **(inferred)**. Because the embed is static HTML, a
  truthful "widget installed" tick needs either a referer write on portal load
  (a throttled write per project) or a JS loader. Both are deferred.
- **Rescue timing (#3).** The trial-ending email fires 5 days before trial end, and
  the code's fallback assumes a 14-day trial — so around day 9, with trial-ended
  near day 14. A day-14 nudge would land next to a billing email. Proposal: send
  day 3 and day 7 as nudges, and for a still-empty board replace the day-14 nudge
  by adding the same help to the trial-ending email.
- **Installed-but-quiet vs never-installed** cannot be told apart today (no traffic
  signal), so rescue copy must cover both until #7's deferred half exists.

## 5. Recommended v1

Four working sessions, no new infrastructure, additive fields only:

1. **Owner alert on the first five external posts** (#1).
2. **Checklist rework with seeding surfaced** (#2 + #4): top of home while
   un-activated, feedback-collection steps first, import and "add what you already
   hear" added, data-driven ticks for posts, teammates and custom domain.
3. **Rescue emails** (#3): day 3 and day 7 for empty boards, activation help folded
   into the trial-ending email, one quiet-board email per four weeks for activated
   boards. Opt-out through the existing digest opt-out
   (`Account.digestOptOutForProjectIds`).
4. **Measurement** (#5): `created` on `ProjectModel`, `lastSeenAt` on `Account`
   (written at most once a day), a nudges-sent marker on `Account`, and the JMX
   baseline report from section 3. All nullable; legacy rows fall back to
   `Account.created`.
5. **Dead-embed log line** (#7, log only).

**Deferred:** email-in; starter posts; embed JS loader or referer tracking; a
"this board has closed" page for visitors of dead boards; an in-app analytics
view; any change to plan gating (section 6); all AI work.

## 6. Plan gating and self-host

Activation help is free on every plan. Nothing in v1 is plan-limited: the digest
is already ungated for cloud plans (`PLANS_WITHOUT_WEEKLY_DIGEST` covers only
license-only accounts), and the checklist, alerts and rescue emails follow it.
Paywalling the thing that makes a customer successful enough to pay would be
self-defeating.

Two existing gates work against activation and need a board decision, not a code
default: GitHub sync and API keys are blocked on `cloud-free`,
`cloud-starter-monthly` and `cloud-monthly`, and imported posts count toward the
`cloud-free` 100-post cap.

One discrepancy to re-check: `CommonPlanVerifyStore.java:174` blocks custom
domains on `cloud-starter-monthly`, while the post-mortem places the churned
custom-domain cohort on plans reachable from the $6 tier. The cohort was probably
on older plans **(inferred)**; this affects the P4 pricing argument, not this spec.

**Self-host:** checklist and owner alerts behave identically and depend only on
the operator's own mail setup. Rescue emails ship default-off for self-host-like
environments behind one config flag — an operator nagging themselves is noise.
Nothing phones home.

## 7. Success metrics

We have almost no analytics, so the plan is cohort comparison from data we already
store plus the v1 fields.

| Metric | Source | 30 days | 60 days |
|---|---|---|---|
| Activation rate of new projects | JMX report, by creation month | Baseline known; first post-ship cohort still maturing | Post-ship cohort vs baseline |
| Median days to first external post | Same report | Baseline | Comparison |
| Owner returns within 72h of a nudge | `lastSeenAt` vs nudge marker | First read | Per-email comparison; drop any that does nothing |
| Checklist items completed | Account attrs + data-driven ticks | Counts | Which step people stop at |
| Unsubscribes and reply volume | Opt-out set; inbox | Watch weekly | Kill the sequence if replies cost more than they return |
| Trial-to-paid, 90-day retention | Stripe (board only) | — | First indication |

Honest limits: new-project volume is small, so 30 days gives direction, not
significance. Decision rule at 60 days: if post-ship cohorts are not visibly above
baseline (roughly ten points of activation rate) and no quiet board has been
pulled back, stop adding to this and move to ingestion.

## 8. Open questions for the board

1. **Sequence:** approve activation v1 ahead of all AI work (P2)?
2. **Definition:** accept "3 posts from 2 non-moderator authors in 30 days" as the
   activation bar, or set different numbers?
3. **Baseline scan:** approve a one-off read-only JMX scan of production accounts
   and projects, output to the server log?
4. **Email volume:** approve up to two unsolicited nudges in a new account's first
   week, up to five first-post alerts, and one quiet-board email per four weeks —
   all with an unsubscribe link?
5. **Trial email:** for a board with zero external posts, should the trial-ending
   email lead with activation help rather than the subscribe ask? Separately, is an
   automatic trial extension for empty boards on the table?
6. **Gating:** open GitHub sync and API keys to `cloud-free`,
   `cloud-starter-monthly` and `cloud-monthly`? Exempt imported posts from the
   `cloud-free` 100-post cap?
7. **Slack → posts:** change the default to on (or ask during setup) for new
   channel links?
8. **Dead embeds:** when the log shows a live site pointing at a dead board, who
   follows up — and should visitors there see a neutral "this board has closed"
   page instead of an error carrying our name?
9. **Self-host:** agree rescue emails default off there?
