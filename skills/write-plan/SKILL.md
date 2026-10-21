---
name: write-plan
description: >-
  Write the plan for a Clanker Ship ticket, following the team's plan
  instructions. Use when the person asks to plan, design or write up how to do a
  ticket such as WEB-31. Fetches the team's live instructions with
  get_clanker_instructions, saves the plan with update_ticket, and waits for
  approval before implementing.
---

# Write a ticket's plan

A ticket's plan is the Markdown document a clanker implements. Each team keeps
plan instructions: a template and guidance, which default to Clanker Ship's plan
loop. Follow the live instructions every time.

## Steps

1. Call `get_ticket` with the ticket's ID to read its title, summary and team.
2. Call `get_clanker_instructions` with `kind: "plan"` and the ticket's team key.
3. Read the code and tests the ticket touches. Follow the guidance; ask the person
   only when the answer changes what gets built or tested.
4. Write the plan from the template, filling every section.
5. Call `update_ticket` with the ticket's ID and the plan.
6. Present the plan, link the ticket, and stop. Implement only after the person
   approves it.
