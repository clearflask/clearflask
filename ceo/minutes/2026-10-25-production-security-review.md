# Minutes — 2026-10-25 — Production security review

Present: board (Matus), Codex.

- Board requested a review of recent production activity associated with deleted
  test accounts. Detailed evidence is retained privately, outside this public
  cabinet, because it contains customer identifiers and security-sensitive data.
- Board authorized deletion of the remaining related account; deletion was
  verified with a consistent database read.
- Board authorized prioritizing an AI project-authorization fix and deploying it
  to the cloud SaaS. The feature agent agreed to hold pushes and deployments until
  the security deployment completes, then integrate the fix before continuing.
- The fix uses project-specific administrator roles for conversation endpoints
  and checks conversation ownership before streaming responses. Regression tests
  cover unrelated accounts, authorized administrators, inactive subscriptions,
  and stream ownership.
- Board additionally requested that authenticated superadmins be exempt from
  CAPTCHA challenges. That follow-up is coordinated with the feature agent while
  ordinary-user protections and rate limiting are preserved.
- This session authorizes production SaaS deployment, not a versioned release.
