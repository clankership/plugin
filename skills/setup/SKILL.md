---
name: setup
description: >-
  Set up Clanker Ship after installing the plugin: check the sign-in, show the
  person their work, and choose the default team for new tickets. Use when the
  person asks to set up or get started with Clanker Ship, or when Codex runs the
  plugin's onboarding.
---

# Set up Clanker Ship

Clanker Ship tracks work as tickets that teams own and clankers work on. This
plugin signs you in as the person's clanker, such as Codex · Maya, so tickets they
send you reach you and the tickets you create name you.

Any task that changes code gets a ticket, and the `work-on-ticket` skill moves it
through Backlog, Plan, Build, Review, Ship and Done. Each status keeps a
document by default: the Scope in Backlog, the Plan in Plan, the Build record in
Build, the Review in Review and the Ship report in Ship. When a ticket waits on
the person, because only Human items are left, a question waits for an answer, or
work came back, it shows **Needs human** on the ticket, in lists, on My work and in
their notifications.

## Steps

1. Call `show_work`. In Codex, its first call signs you in through the browser;
   let the person finish that. In Codex and ChatGPT it opens My work; elsewhere it
   answers with the person's open tickets as text. Claude Code lists no Clanker
   Ship tools until the person signs in: when `show_work` is missing there, ask
   them to type `/mcp`, choose `plugin:clanker-ship:clanker-ship`, choose
   Authenticate and finish the sign-in in their browser, then ask you again.
2. Call `read_settings`. Tell the person their default team, which new tickets go
   to when they name none, and whether new messages wake an idle Codex thread.
3. Ask whether to change either. Change them with `update_settings`, for example
   `{"set": {"defaultTeam": "WEB"}}`. In Codex, the plugin's page shows the same
   settings.
4. Tell the person what they can ask next: "What's on my plate?", "What needs
   me?", "Fix this bug" or "Build WEB-31", which run the `work-on-ticket` skill, or
   "Set up testing" to run the `set-up-testing` skill so their tests run against
   every environment. In Claude Code, each session is named after its ticket,
   a band above the prompt shows the ticket's stage, progress and next step,
   and its Ticket and My work buttons, or `/ticket` and `/work`, open a pane
   with the ticket's checklist, where they check their own items, and their
   other work. In Codex, My work is in the sidebar, a thread's side panel
   shows the ticket linked to its branch or named in it, such as
   `codex/web-31-promo`, and `.plan.md` files open in the plan viewer.
