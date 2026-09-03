# Minutes — 2026-08-29 — Churn post-mortem, Canny read, SEO alternative pages

Present: CEO (Claude), board (Matus).

## Context

Board asked "figure out what to do next". Prod was verified healthy earlier the
same day (25k req/day, 0 5xx, application log 100% INFO), so the infrastructure
lane that occupied 08-27 → 08-29 is closed. The CEO went looking for business
signal instead of re-reading the backlog.

Board direction given during the session:

> "You can do it in parallel, post mortem, seo alts, p2. But for feature work you
> need to get my sign off as i can help prioritize it. You can also explore our
> competitors, mainly Canny which is our best biggest competitor, likely AI usage
> may be a good value feature tradeoff. uservoice is the largest but old
> competitor likely already stale and covering enterprise customers, not exactly
> the same as us"

And, on churn: "check what those are using now and see why they switched and who
they switched to."

## 1. Churn post-mortem — the assumption was wrong

Full detail in `reports/churn-post-mortem-2026-08-29.md`.

Of 12 dead custom domains, **one** migrated to a competitor
(snow-track.de → **Released**, releasedhub.com), and **one was never churn at
all** (roadmap.intune-manager.com consolidated into roadmap.robopack.com, still a
live customer). The other ten abandoned public feedback boards entirely — nine
never even repointed their DNS, which is the signature of walking away rather
than switching. Every parent company but one is still trading, and none of them
runs a feedback board today.

**Nobody left for Canny.** The failure mode is boards dying of silence, not of
missing features. Every churned account was a custom-domain user, and the
cheapest plan unlocking a custom domain is the **$6/mo Cloud Starter** — the
exact tier `strategy.md` already says to kill.

Also found: **gettippedoff.com still has a `clearflask-feedback-button` on its
live homepage**, pointing at a board that no longer exists. Warmest win-back on
the list, and currently a broken experience carrying our name.

## 2. Canny — the finding that breaks the P2 spec

Full detail in `reports/canny-competitive-2026-08-29.md`.

**Canny gives its AI away on the free plan.** Autopilot — capture, dedupe,
triage, smart replies, comment summaries, theme analysis — is on every tier
including $0, with no published cap. Verified on canny.io/pricing and
canny.io/features/autopilot, cross-checked against four independent pricing
write-ups.

`specs/ai-dedupe-digest.md` proposes gating AI dedupe behind Business tier. That
is now backwards: we would be charging for what the market leader bundles free,
and it would read badly on the very comparison pages built this session.

Canny's real meter is **tracked users** — anyone who posts, votes or comments.
Free to 25, then ~$19, then $79/mo. The meter counts engagement, so a board that
works costs more. **We do not meter users at all.** At $29/mo flat that is a
sharper, truer claim than any AI parity claim, and it gets stronger as a
customer's board succeeds.

Canny's defensible part is **ingestion** (Intercom, Zendesk, Gong, G2, App
Store), not summarisation. Dedupe is now table stakes.

## 3. SEO alternative pages — shipped

New `src/site/Alternatives.tsx` with data-driven per-competitor pages, routed at
`/canny-alternative`, `/uservoice-alternative`, `/fider-alternative`. Each has a
hero, the honest wedge, a small verified comparison table, and a paragraph
stating fairly what the competitor is better at — an overstated claim loses a
visitor who has the competitor's site open in another tab.

UserVoice copy follows the board's steer: aimed at the team UserVoice is too
heavy for, not at its enterprise base.

**Board correction: "read our existing competitors page, it lists all of the
details on what each one is good at."** The CEO had written the first draft from
external research and had not read `Competitors.tsx`, which is our own maintained
comparison of 30+ platforms. Reading it changed the pages materially:

- **Two rows were simply wrong.** The Fider page claimed we have whitelabel and
  Fider does not — our own table shows Fider supports a custom domain, colour
  scheme, injected CSS and removing "Powered by". The UserVoice page implied the
  same. Both corrected; Fider's row now reads as a tie.
- **We were badly under-sold.** The real differentiators were sitting in our own
  data and none of them were in the first draft: **7 content types against
  Canny's 3** (we are the only platform with all of voting, roadmap, changelog,
  knowledge base, forum, blog and custom content); **fastest page load of all 13
  platforms measured** — 2.6s LCP against Canny's 8.2s and UserVoice's 11.0s,
  the slowest tested; credit-system and crowd-funding prioritisation that no
  competitor offers; custom statuses, custom pages, custom HTML.
- **The honest weakness is sharper than assumed.** Integrations: Canny has ~13
  (Slack, Teams, Jira, Zendesk, Intercom, GitHub, Salesforce, Segment, Okta),
  we have three — API, Google Analytics, Hotjar. Plus they have customer
  segmentation and we do not. This is now stated plainly on the Canny page, and
  it confirms `strategy.md`'s "no Jira integration is a silent deal-killer".
- The weak "duplicate detection: both yes" row was dropped — ours is lexical,
  theirs is AI, and the claim would not survive scrutiny.
- `Alternatives.tsx` now carries a header comment naming `Competitors.tsx` as
  the source of truth, and each page links to `/product/compare` under the table
  so the claims are checkable.
- One inaccuracy in `Competitors.tsx` was **not** copied forward: it describes
  small self-host deployments as PostgreSQL; the lean stack is MySQL/MariaDB.
  Worth fixing on that page separately.

**Board correction: "you have no sense in style. look at other landing pages and
see how we write them and rewrite those pages nicely."** The first build was a
hero, a paragraph and a raw table — not how this site writes a landing page.
Rewritten against the existing pages (`LandingOpenSource` in particular):

- `Block type="hero"` with `iconAbove`, as the product pages use, instead of the
  bare `Hero` component, and a one-line description instead of a paragraph.
- **`points` / `counterpoints`** — the real miss. `BlockContent` already renders
  ticks for `points` and crosses for `counterpoints`, which is exactly the shape
  of a comparison argument. The pricing wedge is now three ticks against one
  cross, replacing a four-sentence paragraph.
- `Block type="headingOnly"` for section breaks, and `HorizontalPanels` with
  icon columns for the competitor's strengths — the "Why open source?" pattern —
  instead of hand-rolled Typography and bespoke margin classes. All custom
  section CSS deleted.

Then three layout defects, each found only by looking at the rendered page:

- **Section headings ran full-bleed left.** Fixed with a centered max-width
  class, which also needs Block's `noSpacing` — Block's default `10vw` padding
  would otherwise squeeze a max-width title into a ribbon on a wide screen.
- **Two panels in an `lg` container get flung to opposite edges**, since each
  takes an equal share. `maxWidth` now tracks the column count (`lg` for three,
  `md` for two).
- **`staggerHeight={100}`**, copied from the open-source page, reads as lopsided
  under a centered heading. Now `0`.

LESSON: typechecking and a green build say nothing about whether a page looks
right. Three rounds of visual defects survived a clean `tsc` and a successful
production build. Open the page.

There is **no sitemap for the marketing site**, so the pages are linked from a
new "Alternatives" footer dropdown; otherwise nothing would point at them and
they would not be crawled.

Also corrected on the public compare page: ClearFlask was advertised at
"$10/$100 per tracked user" — neither the price nor the model is real. It is now
the live flat $6/$29 with no metering. Canny's tiers updated to the verified
free/$19/$79. Their per-user overage rates are unpublished, so the extrapolation
beyond each tier is flagged in-code as an estimate and still needs a pass.

Verification: frontend typecheck **0 errors in `src/`** (the 10 reported errors
are pre-existing in `node_modules`); production frontend build run.

## 4. Not done — needs board sign-off

P2 implementation was **not** started, per the board's instruction that feature
work needs sign-off. The Canny finding changes what should be built, so the ask
below is a re-aim rather than a go/no-go.

## Board asks

1. **Re-aim P2**: do not gate dedupe as premium; keep the digest half; move the
   headline to ingestion. Sign-off needed before implementation.
2. **Stripe MRR + churn timeline** — the logs give identity, not dates or
   dollars. Only the board can see this. Churn *rate* is still unknown.
3. **Reconsider the $6 Cloud Starter tier** — it is where the churn lives.
4. **Win back gettippedoff.com** — CEO can draft, board must send.
5. Still open from earlier: the three July 18 outreach items (PikaPods app-request,
   Elestio contact@, Railway partner form) and **Search Console** coverage.
6. Open question: does churn-by-silence argue for **activation** work above *any*
   AI work? CEO leans yes, pending the Stripe numbers.
