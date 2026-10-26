# Superadmin account deletion — 2026-10-25

Participants: Matus (board), Codex.

- Board requested a superadmin page, modeled on Login As, for choosing and
  permanently deleting an account; explicitly authorized commit, push, and SaaS
  production deployment.
- Added account search and pagination, an email confirmation dialog, current-account
  protection, and progress/error/success feedback using the existing superadmin API.
- Corrected deletion ordering so billing can read the account before its record is
  removed. Existing project deletion and teammate-access cleanup are reused.
- Versioned self-host release was not requested; production deployment uses CI.
- Board additionally requested that verified superadmins never receive CAPTCHA.
  Kept IP rate limiting before authentication and deferred CAPTCHA until after
  authentication. Only a verified superadmin principal with the superadmin role is
  exempt, including while impersonating; ordinary and anonymous requests retain
  CAPTCHA, including requests from the same IP.
- Production deployment is sequenced after a separately coordinated AI access
  authorization hotfix. No release or version bump (explicit board clarification).
- Regression coverage: UI confirmation/cancel/error/duplicate submission; billing
  cleanup ordering; CAPTCHA exemption, same-IP normal-user protection, retained
  rate limits, and filter ordering on public/protected endpoints.
- Validation: all 366 Java unit tests and three frontend UI regressions passed.
  Full reactor build uses `mvn clean install -DskipITs -Ddocker.skip=true`
  locally because the Docker daemon is unresponsive; all modules compile, and
  only local container-image creation is omitted. Production artifacts are built
  by the normal CI deployment workflow.
