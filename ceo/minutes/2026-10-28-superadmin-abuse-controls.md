# Superadmin registration abuse controls

Date: 2026-10-28. Participants: Matus (board), Codex.

Matus requested a simpler account deletion confirmation, superadmin controls to
allow or block registrations and require CAPTCHA for every registration, and an
automatic one-month lifetime for the temporary incident probe checker.

The account deletion dialog keeps account details, cancellation, irreversible
operation warning, current-account protection and duplicate-submit prevention,
while removing the typed-email confirmation field.

The new Anti-spam / Abuse page controls public dashboard account and portal user
registration. Settings persist in shared storage and default to registrations
allowed with mandatory CAPTCHA enabled. Both API operations require superadmin
access. Existing identities can still sign in when registration is blocked;
new SSO/OAuth identities are checked at creation. Admin provisioning remains
available. CAPTCHA exemption for validated superadmins and normal rate limits
are preserved. Changes are audited without credentials.

The separate temporary probe watcher has a hard one-calendar-month expiry from
its activation; it exits before account lookup, log scanning or deletion after
that deadline. The corresponding closeout reminder was moved. Hourly reviews
remain cancelled. Private operational details stay outside this repository.

Validation: final CI=true all-module clean install completed successfully with
396 Java tests and six UI regressions, frontend/Connect production compilation,
and packaging. Local Docker images alone were skipped because the local daemon
is unavailable. Targeted lint passed with zero warnings. Built dashboard bundle
contains both abuse controls and no typed-email deletion prompt. The separate
watcher's expired branch was tested to exit before account lookup or log scans.

Production deployment 40711818156 succeeded for application commit f6e4a60c.
Live superadmin GET/PUT/readback confirms both registrations and mandatory
registration CAPTCHA enabled; anonymous settings access returns 403. All five
non-creating registration boundary probes return 429 with a CAPTCHA challenge.
The live dashboard.0bf2353c.chunk.js matches the tested local bundle and contains
the new controls and confirmation dialog, without the typed-email prompt.
Health returns 200. No production account was deleted for validation.
