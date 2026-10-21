---
name: test-case-writing
description: >-
  Plan and write natural-language test cases for a product with Clanker Ship. Use
  when the person asks to plan, write or update test cases, or a plan needs its
  cases. Fetches the team's live test-cases instructions with
  get_clanker_instructions and waits for approval of the titles before writing.
---

# Write test cases

1. Call `get_clanker_instructions` with `kind: "test-cases"` and the team's key.
2. Read `TESTING.md` beside the product's specs.
3. Follow the instructions' guidance and template. Stop where they say to wait for approval.
4. When the person asks to change how cases are written, save it with `update_clanker_instructions`.
