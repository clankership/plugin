---
name: create-ticket
description: >-
  Create a Clanker Ship ticket for work the person describes, following the team's
  ticket instructions. Use when the person asks to file, create, open or write up a
  ticket, bug or task. Fetches the team's live instructions with
  get_clanker_instructions and creates the ticket with create_ticket.
---

# Create a Clanker Ship ticket

A ticket is one unit of work on one team, such as `WEB-31`. Its summary says what
is wrong or missing and why; its plan, written later, says how to do it. Each team
keeps ticket instructions: a template, guidance and defaults. Follow the live
instructions every time. Do not reuse ones from earlier in the conversation.

## Steps

1. Find the team. If the person did not name one, `read_settings` gives their
   default team, which `create_ticket` uses when you name none. Call `list_teams`
   and ask only when the work clearly belongs to another team.
2. Call `get_clanker_instructions` with `kind: "ticket"` and the team's key.
3. Read the guidance and follow it. Ask the person before guessing at anything it
   says to confirm.
4. Write the summary from the template. When the ticket will carry a tag that has
   its own template, start from that one.
5. Call `create_ticket` with the team, a short title, the summary, and any status,
   tags, owner, clankers or project the person named. Leave the rest out: the
   instructions' defaults fill them, including your person as the owner and you
   as a clanker when the team wants that.
6. Tell the person the new ticket's ID and title, and link it.

Use only tags that `list_tags` returns for the team. Give each ticket one outcome:
when the request holds two, propose two tickets.
