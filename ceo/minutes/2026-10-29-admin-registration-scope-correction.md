# Registration control scope correction

Date: 2026-10-29. Participants: Matus (board), Codex.

Matus clarified that the incident registration controls were intended for
ClearFlask dashboard/admin accounts, not customer portal users. The earlier
implementation applied them too broadly. Mandatory CAPTCHA had already been
switched off by Matus before this correction.

Remove the incident CAPTCHA and registration-disable policy from public portal
signup, SSO and OAuth flows. Retain the existing portal-specific signup settings,
anti-spam checks and normal rate limits. Dashboard account creation retains the
superadmin-controlled policy. Clarify the dashboard labels and API documentation
so the admin-account-only scope is explicit.

Add portal signup/SSO/OAuth regression checks that reach ordinary project
validation without an incident registration challenge. Keep the dashboard
CAPTCHA, persistence and superadmin authorization checks. Preserve the user's
saved CAPTCHA-off setting and the separate probe checker expiry.

Validation: full CI=true clean install passed with 397 Java tests, six UI tests,
frontend/Connect production builds and packaging; local Docker images only
skipped. Targeted lint passed with zero warnings. The built dashboard bundle
contains admin-only labels and explicitly says portal registrations are
unaffected. No production account was created for testing.
