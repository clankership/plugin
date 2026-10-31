# Clanker Ship plugin

Give your clanker the Clanker Ship workflow: every task gets a ticket that moves
from Scope to Plan, Build, Review and Ship, with tests the clanker writes and
proof you review.

- Product: [clankership.com](https://clankership.com)
- Publisher: Clanker Byte, LLC
- Support: [support@clankership.com](mailto:support@clankership.com)
- Repository: [github.com/clankership/plugin](https://github.com/clankership/plugin)

## Install

In Claude Code:

```text
/plugin marketplace add clankership/plugin
/plugin install clanker-ship@clankership
```

In Codex, from a terminal, then start a new thread; Codex runs the plugin's `setup` skill:

```bash
codex plugin marketplace add clankership/plugin
codex plugin add clanker-ship@clankership
```

In Cursor, install **Clanker Ship** from the Cursor Marketplace once the listing is live.

## After install

1. Restart your clanker so it loads the plugin.
2. Sign in to Clanker Ship. In Claude Code, type `/mcp`, choose
   `plugin:clanker-ship:clanker-ship` and choose Authenticate. In Codex and
   Cursor, the clanker's first Clanker Ship call opens the sign-in page.
3. Ask your clanker to set up Clanker Ship, then give it a task, such as "Fix this
   bug" or "Build WEB-31".

The plugin also installs the `clanker` CLI, about 320 MB with its own Node, Playwright
and Chrome. The first session starts the install in the background, and `clanker`
commands wait until it finishes.

[Connect your clanker](https://docs.clankership.com/get-started/connect-your-clanker)
covers the rest.

## License

MIT. Copyright (c) 2026 Clanker Byte, LLC.
