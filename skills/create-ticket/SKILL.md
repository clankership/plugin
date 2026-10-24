---
name: create-ticket
description: >-
  Create a Clanker Ship ticket for work the person describes and write its Scope,
  following the instructions of the status it starts in. Use when the person asks
  to file, create, open or write up a ticket, bug or task. Fetches the status's live
  instructions with get_clanker_instructions, creates the ticket with create_ticket
  and writes its Scope with write_document.
---

# Create a Clanker Ship ticket

A ticket is one unit of work on one team, such as `WEB-31`. It keeps a document for
each stage: its Scope says what done means and why; its Plan, written later, says how
to get there. Each status keeps instructions: the name of its document, the template
that document starts from, and guidance on how to work it. Follow the live
instructions every time. Do not reuse ones from earlier in the conversation.

## Steps

1. Find the team. If the person did not name one, `read_settings` gives their
   default team, which `create_ticket` uses when you name none. Call `list_teams`
   and ask only when the work clearly belongs to another team.
2. Call `list_tickets` with the team. When an open ticket already covers the work,
   show it to the person instead of creating another.
3. Find the status the ticket starts in: the one the person named, else the
   `status` in the defaults from `get_clanker_instructions` with `kind: "ticket"`,
   else the team's default status from `list_ticket_statuses`. In a new workspace it
   is Backlog.
4. Call `get_clanker_instructions` with that `status` and the team's key. Read the
   guidance and follow it; ask the person before guessing at anything it says to
   confirm.
5. Draft the status's document, usually the Scope, from its template and the
   person's words. When the guidance says to ask open questions, ask them one at a
   time, each with your recommendation, and write each answer in.
6. Call `create_ticket` with the team, a short title, and any status, tags, owner,
   clankers or project the person named. Leave the rest out: the ticket
   instructions' defaults fill them, including your person as the owner and you as a
   clanker when the team wants that.
7. Call `write_document` with the new ticket's ID, the document's name from the
   instructions, the draft, and `baseRevision: 0`. Skip this when the status keeps
   no document.
8. Check the Clanker items of the ticket's checklist that the document now covers
   with `update_checklist_item`. Leave Human items, such as Scope approved, to the
   person.
9. Tell the person the new ticket's ID and title, link it, and say what is left for
   them, such as approving the Scope.

Use only tags that `list_tags` returns for the team. Give each ticket one outcome:
when the request holds two, propose two tickets.
