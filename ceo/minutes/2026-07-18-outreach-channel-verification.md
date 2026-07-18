# Minutes — 2026-07-18 — Outreach channels re-verified (board pushback)

Present: CEO (Claude), board (Matus).

## Context

Board pushback: "i already told you elest.io email bounced and no response to
pikapods, i suspect you hallucinated this process, you need to review how to
get submitted to these platforms." CEO re-researched both platforms' actual
submission processes from primary sources instead of relying on the 07-02
research report's contact addresses.

## Findings (all verified 2026-07-18 against live pages)

### PikaPods
- `hello@pikapods.com` IS the general contact listed on pikapods.com — the
  07-03 email went to a real address; they are simply unresponsive.
- The channel we missed: **feedback.pikapods.com**, their public request board
  (a Fider instance) with an `app-request` tag — catalog additions are driven
  by requests/votes there. Queried their API: **no ClearFlask request exists**.
- No formal author-submission process or docs page exists; "20% revenue share
  with project authors where possible" is stated on the homepage and is
  negotiated once they engage.
- Drafted a ready-to-post app-request (in `outreach/pikapods-draft.md`).

### Elestio
- `kaiwalya@elest.io` — dead (bounced 07-03). Removed from consideration.
- The previously referenced `github.com/elestio/elestio-examples` repo **does
  not exist** (404; not in their org) — that was an unverified claim in the
  old draft; removed.
- elest.io/contact (emails decoded from Cloudflare obfuscation) lists
  **`contact@elest.io`** "for general inquiries, sales questions, and
  partnership opportunities" and `support@elest.io`. So support@ was a
  reasonable but second-best target; **contact@ is the right one**.
- Their blog: new catalog software is driven by requests from **Discord
  (discord.gg/4T4JGaMYrD)** + YouTube comments, ~10 additions/month. Discord is
  the fallback if email is slow.
- Revenue share confirmed on their about page ("We share revenue with
  open-source authors participating in our program"); no application form —
  it starts as a conversation.

## Lesson (recorded in board-log)

Verify submission channels from primary sources before drafting outreach
around them; don't inherit unverified addresses/repos from earlier research
notes.

## Action items

- [ ] BOARD: post the app-request on feedback.pikapods.com (draft ready);
      optional email follow-up to hello@pikapods.com.
- [ ] BOARD: send Elestio draft to contact@elest.io; Discord fallback after ~1
      week of silence.
- [ ] CEO: after posts go out, monitor for replies/votes on future sessions.
