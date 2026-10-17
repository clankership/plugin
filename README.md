# Clanker Ship plugin

Give your coding agent the Clanker Ship method for writing and generating
validation tests. Agents write the tests. You review the proof.

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

1. Reconnect or restart the Clanker Ship MCP server.
2. Sign in to Clanker Ship on the authorization page.
3. Ask your agent to write or generate validation tests.

The production MCP server is `https://api.clankertest.com/agent/mcp`.

## What the agent can do

- Write test cases, generate their specs, and set up a product's Fixture API and CI
  from your team's live test instructions, with the `test-case-writing`,
  `test-code-generation` and `set-up-testing` skills. Tell the agent how your team
  writes tests and it saves that to the instructions
- Read and manage the workspace's products, environments and deployments, within
  the scopes you grant (`read`, `write`) and your workspace role
- Create tickets and write their plans from your team's ticket and plan
  instructions, with the `create-ticket` and `write-plan` skills
- Receive tickets people send you: the hooks add new messages at session
  start and on each prompt, and keep a turn going while messages wait. In Claude
  Code, start with `claude --channels plugin:clanker-ship@clankership` so new
  messages wake an idle session; in Codex, the plugin hands them to the thread
- Show your work, a ticket or the agent's inbox with `show_work`, `show_ticket` and
  `show_inbox`. Clients that render MCP Apps, such as Codex desktop and Cursor,
  draw them as screens where you change a status or ask the agent to start;
  terminals get the same answer as text with a link
- In Codex: My work in the sidebar, the ticket a thread's branch names in its
  side panel, `.plan.md` files in a plan viewer that publishes them to their
  ticket, tickets in the composer's `@` list, and the default team and Wake
  idle threads on the plugin's page. After installing, the `setup` skill walks
  you through it
- Follow coverage levels, behavior and journey kinds, and the approved-contract loop
- Generate Playwright specs that run in every environment, production included,
  and leave no test data behind

## License

MIT. Copyright (c) 2026 Clanker Byte, LLC.

## Clanker CLI

Adding this plugin installs the standalone `clanker` CLI, about 320 MB with its
own Node, Playwright and Chrome. The first agent session without the CLI starts
the install in the background from clankertest.com and says so; `clanker`
commands wait until it finishes. It installs into `~/.local/bin` and
`~/.local/share/clanker` (Windows: `%LOCALAPPDATA%\Clanker`) and then updates
itself in the background at most once an hour. Shell profiles are not modified;
the hook adds the bin folder to PATH for agent sessions that lack it. To install
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
