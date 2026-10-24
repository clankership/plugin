# Clanker Ship plugin

Give your clanker the Clanker Ship workflow: every task gets a ticket that moves
from Scope to Plan, Build, Review and Shipping, with tests the clanker writes and
proof you review.

- Product: [clankertest.com](https://clankertest.com)
- Publisher: Clanker Byte, LLC
- Support: [support@clankertest.com](mailto:support@clankertest.com)
- Repository: [github.com/clankership/plugin](https://github.com/clankership/plugin)

## Install

The plugin talks to Clanker Ship over MCP. After install, complete the browser
sign-in when your client asks.

### Cursor

Install **Clanker Ship** from the Cursor Marketplace once the listing is live.

### Claude Code

```text
/plugin marketplace add clankership/plugin
/plugin install clanker-ship@clankership
```

### Codex

From a terminal, add this repository as a marketplace and install the plugin:

```bash
codex plugin marketplace add clankership/plugin
codex plugin add clanker-ship@clankership
```

Then start a new thread; Codex runs the plugin's `setup` skill.

## After install

1. Restart your clanker so it loads the plugin.
2. Sign in to Clanker Ship. In Claude Code, type `/mcp`, choose
   `plugin:clanker-ship:clanker-ship` and choose Authenticate. In Codex and
   Cursor, the clanker's first Clanker Ship call opens the sign-in page.
3. Ask your clanker to set up Clanker Ship, then give it a task, such as "Fix this
   bug" or "Build WEB-31".

The production MCP server is `https://api.clankertest.com/mcp`.

## What the clanker can do

- Write test cases, generate their specs, and set up a product's Fixture API and CI
  from your team's live test instructions, with the `test-case-writing`,
  `test-code-generation` and `set-up-testing` skills. Tell the clanker how your team
  writes tests and it saves that to the instructions
- Read and manage the workspace's products, environments and deployments, within
  the scopes you grant (`read`, `write`) and your workspace role
- Work any task as a ticket with the `work-on-ticket` skill: find the ticket or
  create one, link it to the branch, then write each status's document (Scope,
  Plan, Build record, Review, Ship report) from your team's status instructions,
  link the pull request it opens to the ticket, and move it on to Done once the
  change runs in production. Clankers do a checklist's
  Clanker items and leave Human ones, such as Plan approved, to you, or check one
  with your words when you approve it in the conversation
- Ask you a question when a decision is yours: the ticket shows Needs human, with
  the question and an answer box, until you answer there or in the conversation
- Name the branch's ticket, its status, the next Clanker item and why it waits on
  you at each prompt, through the plugin's hook
- Receive tickets people send you: the hooks add new messages at session
  start and on each prompt, and keep a turn going while messages wait. In Claude
  Code, start with `claude --channels plugin:clanker-ship@clankership` so new
  messages wake an idle session; in Codex, the plugin hands them to the thread
- Show your work, your clankers, a ticket or the clanker's inbox with `show_work`,
  `show_clankers`, `show_ticket` and `show_inbox`. Clients that render MCP Apps, such as Codex desktop and Cursor,
  draw them as screens where you change a status or ask the clanker to start;
  terminals get the same answer as text with a link
- In Codex: My work in the sidebar, the ticket a thread's branch works on in its
  side panel, `.plan.md` files in a plan viewer that publishes them as their
  ticket's Plan, tickets in the composer's `@` list, and the default team and Wake
  idle threads on the plugin's page. After installing, the `setup` skill walks
  you through it
- Follow coverage levels, behavior and journey kinds, and the approved-contract loop
- Generate Playwright specs that run in every environment, production included,
  and leave no test data behind

## License

MIT. Copyright (c) 2026 Clanker Byte, LLC.

## Clanker CLI

Adding this plugin installs the standalone `clanker` CLI, about 320 MB with its
own Node, Playwright and Chrome. The first clanker session without the CLI starts
the install in the background from clankertest.com and says so; `clanker`
commands wait until it finishes. It installs into `~/.local/bin` and
`~/.local/share/clanker` (Windows: `%LOCALAPPDATA%\Clanker`) and then updates
itself in the background at most once an hour. Shell profiles are not modified;
the hook adds the bin folder to PATH for clanker sessions that lack it. To install
it yourself, run `curl -fsSL https://clankertest.com/install.sh | sh` (Windows:
`irm https://clankertest.com/install.ps1 | iex`).

Run `clanker auth login` for browser approval, or supply `CLANKER_API_KEY` for
automation. Use `clanker product`, `clanker environment`, `clanker deployment`,
`clanker vault secret`, and `clanker vault key` for management. Secret values enter through stdin, or
`clanker vault secret generate` creates them on the server.
Vault keys are runtime production-read credentials, never CLI login credentials.

`clanker run --environment <environment>` runs the project's Playwright specs with
the CLI's own Playwright against that deployment of the linked product, so the
project doesn't need Playwright installed, and publishes the run to the workspace.
`clanker retry` runs failed tests again on the same commit and marks tests that
then pass as flaky. The CLI always talks to clankertest.com. See the
[test runs guide](https://docs.clankertest.com/get-started/concepts/test-runs) and the
[vault and CLI guide](https://docs.clankertest.com/get-started/concepts/secrets-vault).
