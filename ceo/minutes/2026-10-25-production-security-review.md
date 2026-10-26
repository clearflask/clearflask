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
- Authenticated manual browser walkthrough was unavailable. Subsequent diagnosis
  corrected the initial expired-login explanation: a valid superadmin session
  survived deletion of the impersonated account, but protected dashboard requests
  did not fall back to that identity. No production account was deleted during
  feature verification. No versioned release was cut.
- Follow-up fixes that mismatch by using the validated superadmin identity only
  when no API-key or regular-session identity exists. Valid impersonation keeps
  precedence, and project permissions remain scoped to the effective account.
  Regression coverage includes revoked impersonation, ordinary sessions,
  untrusted/expired super cookies, and unrelated-project denial.
- After sign-in was restored, the production superadmin page loaded, account
  search returned results, and the delete-confirmation dialog opened and canceled
  successfully without CAPTCHA. Its final delete button remained disabled until
  email confirmation. No account was deleted during this check.
- Session-fallback validation: the new suite reproduced three expected failures
  before the fix and passed afterward. Full `CI=true` clean reactor install passed
  380 Java tests and four UI regressions, frontend/Connect compilation and all
  module packaging. Only local Docker images were skipped because the local daemon
  was unavailable; production artifacts are built by CI.
