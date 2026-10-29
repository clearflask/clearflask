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

Production workflow 40897214104 succeeded for d8a1dd52. The initial archive
copy raced Tomcat's automatic deployment scanner; the complete CI-built archive
passed CRC validation and was redeployed atomically through the existing
management interface. Verified served context 20261029151244-2.7.1-SNAPSHOT.
Deployed portal signup, bind and user-store classes contain no incident
registration policy references; the admin account guard remains. Live portal
signup and SSO probes reach ordinary missing-project validation (404) without a
CAPTCHA challenge. The saved admin CAPTCHA-off setting remains unchanged.
Health is 200 and the live dashboard bundle has explicit admin-only labels.
Follow-up: make archive promotion atomic in the CI deployment command to prevent
Tomcat scanning a partially copied WAR.
