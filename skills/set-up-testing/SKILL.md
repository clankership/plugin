---
name: set-up-testing
description: >-
  Set up a product so its Clanker Ship tests run in every environment, production
  included: a Fixture API, TESTING.md, test helpers and CI. Use when the person
  asks to set up testing, add a Fixture API, or run tests against staging or
  production. Fetches the team's live fixtures and test-ci instructions.
---

# Set up testing

1. Call `get_clanker_instructions` with `kind: "fixtures"`, then with `kind: "test-ci"`, and the team's key.
2. Follow the fixtures guidance to build the Fixture API, set each deployment's fixture URL, and write `TESTING.md` from its template.
3. Follow the test-ci guidance to add the CI runs.
4. Run `clanker fixtures check --environment <env>` for every environment until it passes. Stop where the instructions say to wait for approval.
5. When the person asks to change how testing is set up, save it with `update_clanker_instructions`.
