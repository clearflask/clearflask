# Spec — AI duplicate detection + AI weekly digest (P2)

_Status: DRAFT 2026-07-13, for board review. Codebase audit done (same day);
findings below make this much cheaper than assumed._

## Why (strategy)

Category value is shifting from "collect votes" to feedback intelligence. This is
the relaunch story: "open-source Canny alternative with AI triage". Ship behind a
paid gate (cloud Business tier / self-host with own API key) → open-core revenue
lever, and the headline for the Product Hunt / Show HN relaunch.

## Audit findings (what already exists)

The codebase is ~70% of the way there:

1. **Post merging is DONE** — production functionality, not a TODO:
   `ideaMerge`/`ideaMergeAdmin`/`ideaUnMergeAdmin` APIs (api-idea.yaml), data
   model (`mergedToPostId`, `mergedPostIds`), impl
   `DynamoElasticIdeaStore.mergeIdeas()` (:630), admin UI
   `PostConnectDialog.tsx` (merge/link toggle, copies votes/comments/
   subscribers). Merged posts are excluded from search.
2. **Lexical "similar posts" is DONE** — `IdeaSearch.similarToIdeaId`:
   ElasticSearch MoreLikeThis (`DynamoElasticIdeaStore.java:1137`) or MySQL
   LIKE (:1027); already wired into post-create
   (`PostCreateForm.tsx` searchSimilarDebounced → `PostConnectDialog`) so end
   users get duplicate suggestions as they type.
3. **Weekly digest is DONE** — `core/email/WeeklyDigestService.java`: daily
   scheduler with per-ISO-week idempotency via a DynamoDB distributed lock,
   per-account/per-project sections (new feedback, missed notifications, new
   users), email via `OnDigest.java` + `EmailTemplates`, SES transport, and
   plan gating (`PLANS_WITHOUT_WEEKLY_DIGEST` in `CommonPlanVerifyStore`).
4. **LLM plumbing is DONE** — LangChain4j + OpenAI: `LangChainLlmAgentStore`
   (streaming chat, tool calling incl. a `searchPosts` tool), conversation
   history/memory in Dynamo, `LlmResource` SSE endpoints. Config: single
   server-wide `openAiApiKey` (default "none" → feature off), model default
   GPT_4_O_MINI, hot-reloadable.
5. **Plan gating pattern is DONE** — addon flags (whitelabel) or plan
   blocklists (digest) enforced in `CommonPlanVerifyStore`, throwing
   `RequiresUpgradeException`. NOTE: today's AI chat is NOT plan-gated — only
   gated by API-key presence. Fix as part of this work.
6. **No embedding/vector infra exists.** All similarity is lexical.

## Feature 1 — AI duplicate detection + merge suggestions

Net-new work is the *detection/suggestion* layer feeding the existing merge path.

**Approach (v1, no vector DB):** LLM-reranked lexical candidates.
On demand, fetch top-N candidates via the existing `similarToIdeaId` search,
then ask the LLM to judge which are true duplicates (title+description in the
prompt, structured JSON out). No new index, no embedding store, works on both
ElasticSearch and MySQL projects. Embeddings become a v2 optimization only if
rerank quality/cost demands it.

Surfaces, in order of value:
1. **Admin "Suggested merges"** — new admin endpoint
   `ideaDuplicatesGetAdmin(ideaId)` returning scored candidates + one-click
   merge (reuses `ideaMergeAdmin`). UI entry on the post page next to the
   existing link/merge dialog.
2. **Digest section** — "Possible duplicates this week" in the weekly digest
   (feature 2 rides the same detection call).
3. (Later) upgrade the end-user post-create suggestions to the AI-ranked list.

## Feature 2 — AI summary in the weekly digest

Extend `WeeklyDigestService.processAccountProject`: gather the week's new
feedback (the query already exists, :292-310), call the LLM for a 3-5 bullet
themes-summary, render as a new top section in `OnDigest` + `EmailTemplates`.
Skip silently on LLM error/no key (digest must never fail on AI). Add the
duplicate-pairs section from feature 1.

## Gating & config (board input wanted)

- **Cloud:** gate both features (and the existing AI chat) as a Business-tier
  capability via the `CommonPlanVerifyStore` pattern; server-wide OpenAI key,
  we eat token cost (GPT-4o-mini: rerank+digest is fractions of a cent per
  project per week — negligible at current scale).
- **Self-host/platform:** available when the operator sets their own
  `openAiApiKey` (existing config), matching the current AI-chat behavior.
- Open question for board: keep OpenAI-only, or add a configurable base-URL
  note in docs (the config already supports `openAiBaseUrl`, so Ollama/OpenRouter
  work today for self-hosters).

## Build plan (rough)

1. `LlmDuplicateDetectionStore` (candidates via IdeaStore + LLM rerank, JSON
   out) + `ideaDuplicatesGetAdmin` endpoint + plan gate. — the core
2. Admin UI: suggested-merges list on the post page → one-click ideaMergeAdmin.
3. Digest: AI themes section + duplicates section in WeeklyDigestService/OnDigest.
4. Plan-gate the existing AI chat too (currently ungated).
5. Tests + docs; one board-approved release at the end.

No schema migrations, no new infra, no new containers. Estimated: a few working
sessions.

## Relaunch (after ship)

Product Hunt + "Show HN: ClearFlask — open-source Canny alternative with AI
dedupe & digests". Drafts to board before anything goes public.
