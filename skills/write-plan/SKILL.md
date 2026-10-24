---
name: write-plan
description: >-
  Write the Plan for a Clanker Ship ticket, following the instructions of its
  team's Planning status. Use when the person asks to plan, design or write up how
  to do a ticket such as WEB-31. Fetches the status's live instructions with
  get_clanker_instructions, saves the Plan with write_document, and waits for
  approval before implementing.
---

# Write a ticket's plan

A ticket's Plan is the Markdown document a clanker builds from. The team's Planning
status keeps its instructions: the Plan's template and guidance, which default to
Clanker Ship's plan loop. Follow the live instructions every time.

## Steps

1. Call `get_ticket` with the ticket's ID to read its title, status, team,
   checklists and documents.
2. Read the Scope with `get_document`, and any other document the ticket has
   written.
3. Call `get_clanker_instructions` with the planning status and the ticket's team
   key: the ticket's status when its stage is planning, else the team's planning
   status from `list_ticket_statuses`, In Planning by default.
4. Call `get_document` with the document the instructions name, usually Plan. Note
   its `revision`; a Plan nobody has written is at revision 0 and holds the template.
5. Read the code and tests the ticket touches. Follow the guidance; ask the person
   only when the answer changes what gets built or tested.
6. Write the Plan from the template, filling every section.
7. Call `write_document` with the ticket's ID, the document's name, the Plan and
   `baseRevision` set to the revision you read. When it is refused because someone
   changed the Plan since, read it again, keep their change, and write again.
8. Check the Clanker items of the planning checklist the Plan covers with
   `update_checklist_item`. Leave Human items, such as Plan approved, to the person.
9. Present the Plan, link the ticket, and stop. Implement only after the person
   approves it, then follow the guidance's next step.
