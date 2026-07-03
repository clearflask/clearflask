# ClearFlask Business Strategy

_Last updated: 2026-07-02_

## Market reality

Feedback boards are a crowded, commoditized category: Canny, Featurebase, Frill,
Sleekplan, Nolt, UserJot on the paid side; Fider and Astuto on the open-source side.
We will not out-feature Canny solo. Two real openings:

1. **Canny's pricing got aggressive** — teams get pushed from ~$0 to ~$400+/mo fast.
   Persistent stream of "Canny alternative" buyers wanting $20–50/mo or self-host.
2. **Category value is shifting** from "collect votes" to "make sense of feedback" —
   AI dedupe, clustering, digest-to-roadmap. Incumbents charge a premium for it, and
   it's shippable here (LangChain4j already a dependency).

**Our wedge**: most feature-complete open-source option (Fider is simpler, Astuto is
stagnant). Pitch: "open-source Canny — self-host free, or pay us to run it."

## Strategic pillars

### 1. Self-host as the funnel, not the leak
Open-source is distribution. Get listed everywhere self-hosters shop: PikaPods,
Elestio, Cloudron, Railway / DigitalOcean marketplace templates. Several pay revenue
share for hosted deployments — passive income, zero sales effort. Monetize the top of
that funnel with open-core: SSO/SAML, whitelabel, multi-project, priority support
behind self-host license plans (SelfHostPlanStore already exists). Self-hosting
companies are exactly the ones with compliance budgets.

### 2. One AI feature + relaunch
Auto-merge duplicate posts + weekly "what your users are actually asking for" digest.
Highest-leverage product bet: justifies price increases category-wide, demos well,
and gives a legitimate Product Hunt / Hacker News relaunch story ("open-source Canny
alternative with AI triage"). HN loves open-source-vs-expensive-incumbent stories.

### 3. Distribution before features
The product is mature; the pipeline is the constraint. Comparison/SEO pages ("Canny
alternative", "UserVoice alternative", "Fider vs ClearFlask"), G2/Capterra listings,
finish Slack + Jira integrations (plans exist in `plans/`). Integrations unlock B2B
buyers; "no Jira integration" is a silent deal-killer.

### 4. Price for the winnable segment
Don't race Fider to free; don't chase Canny's enterprise. Shape: Free (cloud,
1 project, branded) → ~$29/mo Growth → ~$99/mo Business (SSO, whitelabel, AI) →
self-host license for the compliance crowd. Kill $5–10 tiers — low-price customers
cost the most support per dollar.

### 5. Ruthlessly deprioritize rewrites
React 18 / MUI 5 / Java 17: no customer pays for it. Exceptions from the roadmap:
the two security items (CSS injection in AppThemeProvider, cookie security flags in
AuthenticationFilter) because "open-source and secure" is part of the pitch, and
broken features on the demo path (comment replies; post merging — overlaps with AI
dedupe anyway).

## Contrarian option (parked, revisit if head-on grind stalls)

**Embedded/whitelabel feedback**: SaaS companies wanting a feedback portal inside
their product, under their domain, via API. ClearFlask's multi-project, whitelabel
architecture is unusually well suited. Fewer competitors, higher willingness to pay,
developer buyers who trust open source. Could be the Business-tier headline rather
than a separate product.
