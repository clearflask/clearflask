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
- Production rollout completed successfully: commit `92c23c9b`, GitHub Actions
  [run 40256298160](https://github.com/clearflask/clearflask/actions/runs/40256298160).
  Strict local `CI=true` full-reactor validation passed 372 Java tests and four UI
  regressions; CI built and deployed the production artifacts successfully.
- Live verification: health returned `ok`; backend context is
  `20261026020017-2.7.0-SNAPSHOT`; dashboard bundle contains the account-deletion
  page and email-confirmation dialog. Independent deployed-code inspection
  confirmed the verified-superadmin CAPTCHA exemption, preserved pre-authentication
  IP rate limiting, and project-specific AI authorization.
- Authenticated manual browser walkthrough was unavailable because the browser
  session had expired and sign-in was not refreshed. No production account was
  deleted during feature verification. No versioned release was cut.
