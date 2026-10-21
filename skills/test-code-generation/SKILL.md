---
name: test-code-generation
description: >-
  Generate Playwright specs from approved Clanker Ship test cases. Use when the
  person asks to automate, generate or update the specs for test cases. Fetches the
  team's live test-code instructions with get_clanker_instructions.
---

# Generate test code

1. Call `get_clanker_instructions` with `kind: "test-code"` and the team's key.
2. Read `TESTING.md` beside the product's specs.
3. Follow the instructions' guidance and template. Stop where they say to wait for approval.
4. When the person asks to change how tests are written, save it with `update_clanker_instructions`.
