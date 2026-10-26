# Minutes — 2026-10-26 — Signup abuse response

Present: board (Matus), Codex.

- Board requested network blocking for correlated probe traffic, hourly reviews
  for five days, signup-triggered investigation, and permanent deletion of new
  accounts matching the confirmed campaign. Board later emphasized that rotating
  source addresses make account and CAPTCHA enforcement the primary controls.
- Persistent host firewall rules were installed for confirmed source ranges.
  Detailed addresses, account identities and investigation evidence remain in the
  private incident directory, outside this public cabinet.
- A server timer checks new accounts every minute for five days. Deletion requires
  campaign identity markers plus a successful scripted registration correlated
  with the persisted creation timestamp. Cleanup uses the application endpoint,
  including projects, billing and session revocation, with consistent absence
  verification. Generic names or source-network membership alone do not qualify.
- Five residual/new campaign accounts were deleted and verified absent. Hourly
  review and signup-event triggers are installed; a controlled event confirmed
  delivery back to the investigating agent.
- Board requested CAPTCHA on registration. The implementation checks actual
  account creation, public portal registration, and SSO/OAuth entry paths, before
  consuming one-use OAuth codes. Registration verification fails closed when the
  provider is unavailable; the existing verified-superadmin exemption remains.
- Successful registration CAPTCHA verification is logged without solution tokens
  and correlated with probe requests for investigation. Board requested Telegram
  alerts if attackers solve CAPTCHA; destination/setup is pending from the board.
- Production SaaS deployment only; no versioned release is authorized.
- Full `CI=true` clean reactor install passed 386 Java tests, four UI regressions,
  frontend/Connect compilation and module packaging. Local Docker image creation
  alone was skipped because the local daemon is unavailable; CI builds production.
