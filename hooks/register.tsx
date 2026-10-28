import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";
import type { PaneTab, Progress, Stage, View, ViewItem, ViewTicket, WorkTicket } from "./state";

// Clanker Ship in Claude Code: a band above the prompt with the session's ticket and its
// progress, a pane with its checklist and the person's other work, and messages that start a
// turn. Its data comes from `clanker session connect`, which holds the session's connection to
// Clanker Ship and prints one JSON line per change.

const PANE = "clanker-ship";

const view = atom({ plugin: "clanker-ship", key: "view" } as const, null);
const connected = atom({ plugin: "clanker-ship", key: "connected" } as const, false);
const hidden = atom({ plugin: "clanker-ship", key: "hidden" } as const, false);
const tab = atom({ plugin: "clanker-ship", key: "tab" } as const, "ticket");
const notice = atom({ plugin: "clanker-ship", key: "notice" } as const, null);
const picking = atom({ plugin: "clanker-ship", key: "picking" } as const, false);
const expanded = atom({ plugin: "clanker-ship", key: "expanded" } as const, false);

/** The picker's status groups, work furthest along first, as My work lists them. */
const GROUP_ORDER: readonly Stage[] = [
  "ship",
  "review",
  "build",
  "plan",
  "backlog",
  "done",
  "canceled",
];

/** The sign that something waits on the person, linked to their My clankers page. */
const NEEDS_YOU = "🙋‍♂️";

/** The columns between the ticket's title and its status. */
const STATUS_GAP = 2;

/** The website's colors the band's drawings use, light then dark; work in progress is a lighter green. */
const WEBSITE_COLORS = {
  light: {
    primary: "#2455e8",
    success: "#10b981",
    started: "#6ee7b7",
    muted: "#586984",
  },
  dark: {
    primary: "#9db8ff",
    success: "oklch(0.72 0.17 160)",
    started: "oklch(0.86 0.1 160)",
    muted: "#a5b4ce",
  },
};
type Colors = (typeof WEBSITE_COLORS)["light"];

/** Where a checklist item stands, as the website's checkbox draws it. */
type ItemState = "done" | "in_progress" | "not_started";
const ITEM_ALTS: Record<ItemState, string> = {
  done: "Done",
  in_progress: "In progress",
  not_started: "Not started",
};
/** The item states on the terminal, which draws no Svg: empty, a square inside, and filled. */
const ITEM_GLYPHS: Record<ItemState, string> = { done: "■", in_progress: "▣", not_started: "□" };
/** Their colors there: gray, the bar's lighter green, then green. */
const ITEM_COLORS: Record<ItemState, string> = {
  done: "success",
  in_progress: WEBSITE_COLORS.light.started,
  not_started: "subtle",
};
/** A click moves an item on, as on the website: not started, in progress, done, then over. */
const NEXT_STATE: Record<ItemState, ItemState> = {
  not_started: "in_progress",
  in_progress: "done",
  done: "not_started",
};
/** The CLI's checklist command that puts an item in each state. */
const STATE_COMMANDS: Record<ItemState, string> = {
  not_started: "uncheck",
  in_progress: "start",
  done: "check",
};

const STAGE_LABELS: Record<Stage, string> = {
  backlog: "Backlog",
  plan: "Plan",
  build: "Build",
  review: "Review",
  ship: "Ship",
  done: "Done",
  canceled: "Canceled",
};
/** The website's status icon as a glyph: a circle that fills through the stages. */
const STAGE_GLYPHS: Record<Stage, string> = {
  backlog: "○",
  plan: "◔",
  build: "◑",
  review: "◕",
  ship: "●",
  done: "✔",
  canceled: "✕",
};

/** How long the mod waits before starting `clanker session connect` again, at most. */
const MAX_BACKOFF_MS = 60_000;

type Line =
  | { type: "status"; connected: boolean }
  | { type: "view"; view: View }
  | { type: "message"; text: string };

type Ran<T> = { ok: true; value: T } | { ok: false; error: string };

/** The session the connection serves, and how to end it. */
let connection: { session: string; stop: () => void } | null = null;

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await $.command.register({
      name: "ticket",
      description: "Show this session's Clanker Ship ticket, or pick one: /ticket WEB-31",
    });
    await $.command.register({
      name: "work",
      description: "Show your Clanker Ship work: what needs you, then the rest",
    });
    void connect($);
    return next(e);
  });

  on("session.end", async ($, e, next) => {
    await disconnect($);
    const ended = await next(e);
    // After /clear the process goes on under a new session ID, with no session.start.
    if (e.reason === "clear") void reconnect($);
    return ended;
  });

  on("command.run", { command: "ticket" }, async ($, e) => {
    if (e.args.trim()) return { text: await pick($, e.args.trim()) };
    await update($, hidden, () => false);
    await openPane($, "ticket");
    return { text: "Clanker Ship pane opened." };
  });

  on("command.run", { command: "work" }, async ($) => {
    await openPane($, "work");
    return { text: "Clanker Ship pane opened on My work." };
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const current = await read($, view);
    if (e.props.hasSurvey || !current) return next(e);
    if (await read($, hidden)) return next(e);
    const { Box, Button, Link, Markdown, Text } = $.ui.resolve(e);
    const ticket = current.ticket;
    // The picker lists the person's open tickets by status, work furthest along first, each
    // picked by a click. A long list scrolls in the band.
    if (!ticket && (await read($, picking))) {
      const failure = await read($, notice);
      const groups = byStatus(current.work.tickets);
      // The × sits at the top level, as in the no-ticket band, where the desktop draws its close.
      return (
        <Box>
          <Box flexDirection="column" flexGrow={1} gap={1}>
            <Box gap={1}>
              <Text weight="bold">Pick a ticket for this session</Text>
              <Box flexGrow={1} />
              <Button key="file" label="File one instead" onPress={() => fileOne($)} />
            </Box>
            {failure ? <Text color="error">{failure}</Text> : null}
            {groups.length ? null : <Text dimColor>No open tickets are yours.</Text>}
            {groups.map((group) => (
              <Box key={`group-${group.category}-${group.name}`} flexDirection="column">
                <Text weight="bold">{group.name.toUpperCase()}</Text>
                {group.tickets.map((item) => (
                  <Button
                    key={`choose-${item.id}`}
                    plain
                    onPress={() => choose($, item.identifier)}
                  >
                    🎟️ <Text weight="bold">{item.identifier}:</Text> {item.title}
                  </Button>
                ))}
              </Box>
            ))}
          </Box>
          <Button
            key="cancel"
            plain
            role="dismiss"
            label="×"
            onPress={() => update($, picking, () => false)}
          />
        </Box>
      );
    }
    // One row: the desktop draws a button taller than a text row, so a second row would crowd it.
    if (!ticket)
      return (
        <Box gap={1}>
          <Text dimColor wrap="truncate-end">
            ○ No ticket for this session
          </Text>
          <Box flexGrow={1} />
          <Button key="pick" label="Pick a ticket" onPress={() => update($, picking, () => true)} />
          <Button key="file" label="File one for this" onPress={() => fileOne($)} />
          <Button
            key="hide"
            plain
            role="dismiss"
            label="×"
            onPress={() => update($, hidden, () => true)}
          />
        </Box>
      );
    const status = ticket.status.name.toUpperCase();
    const alt = `${ticket.checklist.done} of ${ticket.checklist.total} checklist items done, ${ticket.checklist.inProgress} in progress`;
    const open = await read($, expanded);
    const failure = await read($, notice);
    // On the desktop a click on the ID opens the ticket in the app's browser pane, and a cmd or
    // ctrl click opens it as any link does, in the person's browser. The opening runs apart from
    // the press, whose hook has ten seconds, since the browser may wait on an approval. The
    // terminal has no browser pane, so there the ID is a plain link.
    const id =
      e.surface === "terminal" ? (
        <Link href={ticket.url}>
          <Text weight="bold">{ticket.identifier}</Text>
        </Link>
      ) : (
        <Markdown
          key="ticket-id"
          text={`[**${ticket.identifier}**](${ticket.url})`}
          onLinkPress={(link) => void browse($, link.href)}
        />
      );
    // A raised hand after the bar when anything waits on the person, this ticket or another: a
    // link to My clankers, opened in the app's browser pane as the ID's page is.
    const waiting = current.work.needsYou > 0 || ticket.needsHuman !== null;
    const hand = !waiting ? null : e.surface === "terminal" ? (
      <Link href={current.work.url} label={NEEDS_YOU} />
    ) : (
      <Markdown
        key="needs-you"
        text={`[${NEEDS_YOU}](${current.work.url})`}
        onLinkPress={(link) => void browse($, link.href)}
      />
    );
    // The terminal draws no Svg, so it lays the bar out in cells across the band's last third,
    // less the status before it; work in progress is light green there.
    let bar;
    if (e.surface === "terminal") {
      const third = Math.floor((e.props.bodyColumns - 1) / 3);
      // The raised hand draws two cells wide, then its gap.
      const hand = waiting ? 3 : 0;
      const cells = barCells(ticket.checklist, third - STATUS_GAP - status.length - 1 - hand);
      bar = (
        <Text>
          <Text color="success">{"━".repeat(cells.done)}</Text>
          <Text color={WEBSITE_COLORS.light.started}>{"━".repeat(cells.inProgress)}</Text>
          <Text dimColor>{"━".repeat(cells.rest)}</Text>
        </Text>
      );
    } else {
      const { Svg } = $.ui.resolve(e);
      const ends = barEnds(ticket.checklist);
      // A drawing stretches to its box, so the rounded ends are drawings of their own. The desktop
      // draws no Svg whose alt is empty, so each has one.
      bar = (
        <Box flexGrow={1}>
          <Svg source={capSvg("left", ends.left)} alt="Progress start" width={3} height={6} />
          <Box flexGrow={1}>
            <Svg source={barSvg(ticket.checklist)} alt={alt} height={6} />
          </Box>
          <Svg source={capSvg("right", ends.right)} alt="Progress end" width={3} height={6} />
        </Box>
      );
    }
    // The status opens and closes the checklist. On the desktop it is a bold link in the link's
    // blue, a cmd or ctrl click opening the ticket's page; a terminal reports no click on a link,
    // so there it is a button.
    const toggle =
      e.surface === "terminal" ? (
        <Button key="toggle" plain onPress={() => update($, expanded, (shown) => !shown)}>
          {status}
        </Button>
      ) : (
        <Markdown
          key="toggle"
          text={`[**${status}**](${ticket.url})`}
          onLinkPress={() => update($, expanded, (shown) => !shown)}
        />
      );
    // Each item's checkbox, right beside the button that cycles it, since a Button holds text
    // alone: the website's on the desktop, all one size so they align, and glyphs on the terminal.
    const mark = (state: ItemState) => {
      if (e.surface === "terminal")
        return <Text color={ITEM_COLORS[state]}>{ITEM_GLYPHS[state]} </Text>;
      const { Svg } = $.ui.resolve(e);
      return <Svg source={itemSvg(state)} alt={ITEM_ALTS[state]} width={14} height={14} />;
    };
    // The × sits at the top level, as in the no-ticket band, where the desktop draws its close at
    // the band's trailing edge, out of the layout.
    return (
      <Box>
        <Box flexDirection="column" flexGrow={1}>
          {/* Two columns: the ticket in two thirds, and its status, the checklist's toggle, and
              progress in the last third. Below, over the open checklist, a step of room: the
              desktop's own small space, no rows on the terminal. */}
          <Box alignItems="center" paddingBottom={open ? "sm" : 0}>
            <Box width="67%" alignItems="center">
              {/* Held at its own width, so a long title is cut short rather than the ID wrapped. */}
              <Box flexShrink={0}>{id}</Box>
              <Text wrap="truncate-end">: {ticket.title}</Text>
            </Box>
            <Box width="33%" gap={1} alignItems="center" paddingLeft={STATUS_GAP}>
              {/* Held at its own width: a Markdown block shrinks to a letter a line beside the
                  growing bar. */}
              <Box flexShrink={0}>{toggle}</Box>
              {bar}
              {hand ? <Box flexShrink={0}>{hand}</Box> : null}
            </Box>
          </Box>
          {failure ? <Text color="error">{failure}</Text> : null}
          {/* The current status's checklist, under the title and headed by the status: a click on
              an item moves it to its next state with the person's own sign-in. */}
          {open ? (
            <Box flexDirection="column">
              <Box paddingY="xs">
                <Text weight="bold" mono>
                  {status}
                </Text>
              </Box>
              {ticket.items.map((item) => (
                <Box key={`item-${item.id}`} alignItems="center">
                  {mark(itemState(item))}
                  <Button
                    key={`cycle-${item.id}`}
                    plain
                    onPress={() => advance($, ticket.identifier, item)}
                  >
                    {item.title}
                    {item.doer === "human" ? <Text dimColor> · Human</Text> : null}
                  </Button>
                </Box>
              ))}
              {ticket.items.length ? null : <Text dimColor>No checklist for this status.</Text>}
            </Box>
          ) : null}
        </Box>
        <Button
          key="hide"
          plain
          role="dismiss"
          label="×"
          onPress={() => update($, hidden, () => true)}
        />
      </Box>
    );
  });

  on("ui.render", { component: "Pane", requestId: PANE }, async ($, e) => {
    const { Box, Button, Link, Text } = $.ui.resolve(e);
    const current = await read($, view);
    const which = await read($, tab);
    const failure = await read($, notice);
    const tabs = (
      <Box gap={2}>
        <Button
          key="tab-ticket"
          hotkey="t"
          plain
          dimColor={which !== "ticket"}
          label={current?.ticket ? current.ticket.identifier : "Ticket"}
          onPress={() => update($, tab, () => "ticket")}
        />
        <Button
          key="tab-work"
          hotkey="w"
          plain
          dimColor={which !== "work"}
          label={current?.work.needsYou ? `My work · ${current.work.needsYou}` : "My work"}
          onPress={() => update($, tab, () => "work")}
        />
      </Box>
    );
    if (!current)
      return (
        <Box flexDirection="column">
          {tabs}
          <Text dimColor>
            {(await read($, connected))
              ? "Reading the session…"
              : "Connecting to Clanker Ship… The Clanker CLI connects once it is installed and signed in."}
          </Text>
        </Box>
      );
    if (which === "work") {
      const tickets = current.work.tickets;
      const needing = tickets.filter((item) => item.needsYou && !item.here);
      const rest = tickets.filter((item) => !needing.includes(item));
      const row = (item: WorkTicket) => (
        <Box key={`work-${item.id}`} flexDirection="column">
          <Box gap={1}>
            <Text color={item.needsYou ? "warning" : "suggestion"}>
              {STAGE_GLYPHS[item.status.category]}
            </Text>
            <Text weight="bold">{item.identifier}</Text>
            <Text wrap="truncate-end">{item.title}</Text>
            <Box flexGrow={1} />
            {item.here ? (
              <Text dimColor>this session</Text>
            ) : (
              <Button
                key={`pick-${item.id}`}
                label="Work on it here"
                onPress={() => pick($, item.identifier)}
              />
            )}
          </Box>
          <Text dimColor wrap="truncate-end">
            {"  "}
            {workDetail(item)}
          </Text>
        </Box>
      );
      return (
        <Box flexDirection="column" gap={1}>
          {tabs}
          {failure ? <Text color="error">{failure}</Text> : null}
          {tickets.length ? null : <Text dimColor>No open tickets are yours.</Text>}
          {needing.length ? (
            <Box flexDirection="column">
              <Text weight="bold" color="warning">
                Needs you
              </Text>
              {needing.map(row)}
            </Box>
          ) : null}
          {rest.length ? (
            <Box flexDirection="column">
              <Text weight="bold" dimColor>
                In flight
              </Text>
              {rest.map(row)}
            </Box>
          ) : null}
        </Box>
      );
    }
    const ticket: ViewTicket | null = current.ticket;
    if (!ticket)
      return (
        <Box flexDirection="column" gap={1}>
          {tabs}
          <Text dimColor>No ticket for this session.</Text>
          <Box gap={1}>
            <Button
              key="to-work"
              label="Pick from My work"
              onPress={() => update($, tab, () => "work")}
            />
            <Button
              key="file"
              label="File one for this"
              onPress={() => $.prompt.fill({ text: "File a ticket for this work" })}
            />
          </Box>
        </Box>
      );
    const human = ticket.items.filter((item) => item.doer === "human" && !item.done);
    const clanker = ticket.items.filter((item) => item.doer === "clanker");
    return (
      <Box flexDirection="column" gap={1}>
        {tabs}
        {failure ? <Text color="error">{failure}</Text> : null}
        <Box flexDirection="column">
          <Text weight="bold" wrap="truncate-end">
            {ticket.identifier} · {ticket.title}
          </Text>
          <Text dimColor>
            {STAGE_GLYPHS[ticket.status.category]} {ticket.status.name} · {ticket.checklist.done} of{" "}
            {ticket.checklist.total}
          </Text>
        </Box>
        {human.length ? (
          <Box flexDirection="column">
            <Text weight="bold" color="warning">
              For you · {human.length}
            </Text>
            {human.map((item) => (
              <Box key={`human-${item.id}`} gap={1}>
                <Text color="warning">☐</Text>
                <Text wrap="truncate-end">{item.title}</Text>
                <Box flexGrow={1} />
                <Button
                  key={`check-${item.id}`}
                  label="Check"
                  onPress={() => check($, ticket.identifier, item.id)}
                />
              </Box>
            ))}
          </Box>
        ) : null}
        <Box flexDirection="column">
          <Text weight="bold" dimColor>
            For the clanker · {clanker.filter((item) => item.done).length} of {clanker.length}
          </Text>
          {clanker.map((item) => (
            <Text key={`clanker-${item.id}`} dimColor={item.done} wrap="truncate-end">
              {item.done ? "✓" : item.title === ticket.next ? "▸" : "○"} {item.title}
            </Text>
          ))}
        </Box>
        {ticket.documents.length ? (
          <Text dimColor wrap="truncate-end">
            {ticket.documents
              .map((document) => `${document.name}${document.written ? " ✓" : ""}`)
              .join(" · ")}
          </Text>
        ) : null}
        <Box gap={2}>
          <Link href={ticket.url} label="Open on Clanker Ship" />
          <Button key="change" label="Change ticket" onPress={() => update($, tab, () => "work")} />
        </Box>
      </Box>
    );
  });
};

/** The plugin's own `clanker`, which waits for an install the session hook started. */
async function cli($: EngineInterface, args: string[]) {
  const windows = (await $.env.get("OS")) === "Windows_NT";
  return [`${$.plugin.root}/bin/${windows ? "clanker.cmd" : "clanker"}`, ...args];
}

/** Runs the CLI and reads its JSON answer; a failure is its last line of error. */
async function run<T>($: EngineInterface, args: string[]): Promise<Ran<T>> {
  try {
    const done = await $.process.run(await cli($, args));
    if (done.exitCode !== 0)
      return { ok: false, error: done.stderr.trim().split("\n").at(-1) || "The CLI failed." };
    return { ok: true, value: JSON.parse(done.stdout) as T };
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** One line `clanker session connect` printed. */
async function take($: EngineInterface, text: string) {
  let line: Line;
  try {
    line = JSON.parse(text) as Line;
  } catch {
    return;
  }
  if (line.type === "status") await update($, connected, () => line.connected);
  else if (line.type === "view") await show($, line.view);
  // A message starts a turn: at once in an idle session, after the turn in a busy one.
  else if (line.type === "message") void $.prompt.submit({ text: line.text });
}

/**
 * Holds the session's connection for as long as the session lasts, starting the CLI again with
 * backoff when it ends; leaving the loop ends the child.
 */
async function connect($: EngineInterface) {
  const session = await $.session.id();
  if (connection?.session === session) return;
  connection?.stop();
  let stopped = false;
  let child: AsyncGenerator<unknown, unknown> | null = null;
  connection = {
    session,
    stop: () => {
      stopped = true;
      void child?.return(undefined);
    },
  };
  let backoff = 1000;
  while (!stopped) {
    const started = await $.clock.now();
    try {
      const stream = $.process.spawn({
        argv: await cli($, ["session", "connect", "--session", session]),
      });
      child = stream;
      let buffer = "";
      for await (const piece of stream) {
        if (stopped) break;
        if (piece.stream !== "stdout") continue;
        buffer += piece.text;
        for (let end = buffer.indexOf("\n"); end >= 0; end = buffer.indexOf("\n")) {
          await take($, buffer.slice(0, end));
          buffer = buffer.slice(end + 1);
        }
      }
    } catch {
      // The CLI is not installed yet, or could not start; try again later.
    }
    await update($, connected, () => false);
    if (stopped) break;
    if ((await $.clock.now()) - started > MAX_BACKOFF_MS) backoff = 1000;
    await $.clock.sleep(backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
  }
}

/** Takes the session's latest view; a ticket other than the one shown brings back a closed band. */
async function show($: EngineInterface, latest: View) {
  const shown = await read($, view);
  if (shown?.ticket?.id !== latest.ticket?.id) await update($, hidden, () => false);
  await update($, view, () => latest);
}

/** Ends the connection and forgets what the session showed. */
async function disconnect($: EngineInterface) {
  connection?.stop();
  connection = null;
  await update($, view, () => null);
  await update($, hidden, () => false);
  await update($, picking, () => false);
  await update($, expanded, () => false);
}

/** Connects again once a /clear has moved the process to its new session. */
async function reconnect($: EngineInterface) {
  await $.clock.sleep(500);
  await connect($);
}

async function openPane($: EngineInterface, which: PaneTab) {
  await update($, tab, () => which);
  await update($, notice, () => null);
  await $.ui.open({ id: PANE, title: "Clanker Ship" });
}

/** Makes a ticket the session's, as the person's pick, and says how it went. */
async function pick($: EngineInterface, ticket: string) {
  const picked = await run<View>($, [
    "session",
    "ticket",
    ticket,
    "--session",
    await $.session.id(),
  ]);
  if (!picked.ok) {
    await update($, notice, () => picked.error);
    return picked.error;
  }
  await show($, picked.value);
  await update($, notice, () => null);
  return `This session works on ${picked.value.ticket?.identifier ?? ticket} now.`;
}

/** Makes a ticket from the band's picker the session's, and closes the picker once it is. */
async function choose($: EngineInterface, ticket: string) {
  await pick($, ticket);
  if (!(await read($, notice))) await update($, picking, () => false);
}

/** A tool of one of the session's MCP servers, by the server's name and its own. */
type McpTool = { server: string; tool: string };

/** The desktop app's tools for its browser pane, beside the chat, and for showing that pane. */
const BROWSER = {
  tabs: { server: "Claude_Browser", tool: "tabs_context" },
  open: { server: "Claude_Browser", tool: "preview_start" },
  navigate: { server: "Claude_Browser", tool: "navigate" },
  front: { server: "Claude_Browser", tool: "tabs_select" },
  show: { server: "ccd_view", tool: "show_pane" },
} as const satisfies Record<string, McpTool>;

/**
 * Opens a page in the desktop app's browser pane with the app's own tools, and says in the band
 * only when it fails; the cmd or ctrl click stays the way out.
 */
async function browse($: EngineInterface, url: string) {
  const instead = "Cmd or ctrl click the link to open it in your browser.";
  const opener = `mcp__${BROWSER.open.server}__${BROWSER.open.tool}`;
  pane.hasBrowser ??= (await $.tool.list()).some((tool) => tool.name === opener);
  if (!pane.hasBrowser) {
    await update($, notice, () => `This session has no browser pane. ${instead}`);
    return;
  }
  await update($, notice, () => null);
  const failure = await Promise.race([
    browseInPane($, url).then(
      () => null,
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    ),
    $.clock.sleep(30_000).then(() => "The app's browser didn't answer in 30 seconds."),
  ]);
  await update($, notice, () => (failure ? `${failure} ${instead}` : null));
}

/**
 * What the session's clicks have learned of the browser pane: whether the session has one, and
 * the tab its Clanker Ship pages open in. A reload of the mod forgets both.
 */
const pane: { hasBrowser: boolean | null; tab: string | null } = { hasBrowser: null, tab: null };

/**
 * Shows a page in the browser pane's tab on its site, the one tab reused click after click, or a
 * new tab when there is none, and brings the pane into view. Once the tab is known, a click loads
 * the page, fronts the tab and shows the pane at once, so the pane opens while the page loads.
 */
async function browseInPane($: EngineInterface, url: string) {
  if (pane.tab) {
    const tabId = pane.tab;
    try {
      await showInTab($, url, tabId);
      return;
    } catch {
      // The tab was closed since: find another on the site, or open one.
      pane.tab = null;
    }
  }
  const listed = await useTool($, BROWSER.tabs, {});
  const tabs = [...listed.matchAll(TAB_PATTERN)].map(([, tabId = "", origin = ""]) => ({
    tabId,
    origin,
  }));
  if (!tabs.length && !listed.includes("browserOpen"))
    throw new Error(`The browser's tab list didn't read: ${listed.slice(0, 160)}`);
  const site = /^[a-z]+:\/\/[^/]+/i.exec(url)?.[0];
  const tab = tabs.find((each) => each.origin === site);
  if (tab) {
    await showInTab($, url, tab.tabId);
    pane.tab = tab.tabId;
    return;
  }
  // A new tab answers with its ID: `Opened tab "tab-3" at …`.
  const opened = await useTool($, BROWSER.open, { url });
  pane.tab = /tab(?:Id)? "([^"]+)"/.exec(opened)?.[1] ?? null;
  await useTool($, BROWSER.show, { pane: "preview" });
}

/** Loads a page in one of the pane's tabs, fronts it and shows the pane, all at once. */
async function showInTab($: EngineInterface, url: string, tabId: string) {
  await Promise.all([
    useTool($, BROWSER.navigate, { url, tabId }),
    useTool($, BROWSER.front, { tabId }),
    useTool($, BROWSER.show, { pane: "preview" }),
  ]);
}

/** Space between JSON's parts, plain or quoted inside other text, where a line break is `\n`. */
const GAP = String.raw`(?:\s|\\[nrt])*`;
/** A JSON quote, plain or escaped. */
const QUOTE = String.raw`\\*"`;
/**
 * One tab of the browser's tab list: its ID, then its origin. The list is JSON followed by a line
 * on the pane, and may come quoted inside other text, so the pattern reads it either way.
 */
const TAB_PATTERN = new RegExp(
  `tabId${QUOTE}${GAP}:${GAP}${QUOTE}([^"\\\\]+)${QUOTE}${GAP},${GAP}${QUOTE}origin${QUOTE}${GAP}:${GAP}${QUOTE}([^"\\\\]+)`,
  "g",
);

/**
 * Calls one of the session's MCP tools as the plugin itself: its answer's text, or why it failed.
 * The person's click is the grant, so no permission check runs; through `$.tool.call`, auto
 * mode's classifier refuses a call that no request of the person's asked for.
 */
async function useTool(
  $: EngineInterface,
  { server, tool }: McpTool,
  input: Record<string, unknown>,
) {
  const done = await $.mcp.call(server, tool, input);
  const text = done.content.map((block) => block.text ?? "").join("\n");
  if (done.isError) throw new Error(text || `${tool} failed.`);
  return text;
}

/** Asks Claude to file a ticket for the work, from the no-ticket band or its picker. */
async function fileOne($: EngineInterface) {
  await update($, picking, () => false);
  await $.prompt.fill({ text: "File a ticket for this work" });
}

/** Checks a Human item with the person's own sign-in: their click is their approval. */
async function check($: EngineInterface, ticket: string, item: string) {
  const checked = await run<unknown>($, ["ticket", "checklist", "check", ticket, item]);
  await update($, notice, () => (checked.ok ? null : checked.error));
}

/**
 * Moves a checklist item to its next state, drawn at once so clicks in a row keep cycling; the
 * view the connection brings next holds the change as Clanker Ship made it.
 */
async function advance($: EngineInterface, ticket: string, item: ViewItem) {
  const state = NEXT_STATE[itemState(item)];
  await update($, view, (shown) =>
    shown?.ticket
      ? {
          ...shown,
          ticket: {
            ...shown.ticket,
            items: shown.ticket.items.map((entry) =>
              entry.id === item.id
                ? { ...entry, done: state === "done", inProgress: state === "in_progress" }
                : entry,
            ),
          },
        }
      : shown,
  );
  const changed = await run<unknown>($, [
    "ticket",
    "checklist",
    STATE_COMMANDS[state],
    ticket,
    item.id,
  ]);
  await update($, notice, () => (changed.ok ? null : changed.error));
}

/** A work ticket's second line: what it waits on the person for, or its stage, and where it is live. */
function workDetail(item: WorkTicket) {
  const state = item.needsYou
    ? `Needs you: ${item.needsYou}`
    : `${STAGE_LABELS[item.status.category]} ${item.checklist.done}/${item.checklist.total}`;
  const live = item.sessions.length
    ? ` · live in ${item.sessions.map((session) => `${session.client} on ${session.computer}`).join(", ")}`
    : "";
  return state + live;
}

/** The checklist's progress over `width` cells: done, then in progress, then the rest. */
function barCells({ done, inProgress, total }: Progress, width: number) {
  const cells = Math.max(width, 0);
  const upTo = (count: number) => (total ? Math.round((count / total) * cells) : 0);
  const filled = upTo(done);
  const started = upTo(done + inProgress);
  return { done: filled, inProgress: started - filled, rest: cells - started };
}

/** A drawing's style in the website's colors, light then dark as the surface prefers. */
function websiteStyle(rules: (colors: Colors) => string) {
  return `<style>${rules(WEBSITE_COLORS.light)}@media (prefers-color-scheme: dark){${rules(WEBSITE_COLORS.dark)}}</style>`;
}

/** The bar's parts: the faint cobalt track, done in green, work in progress in a lighter green. */
type BarPart = "t" | "d" | "p";
const BAR_STYLE = websiteStyle(
  (colors) =>
    `.t{fill:${colors.primary};fill-opacity:.2}.d{fill:${colors.success}}.p{fill:${colors.started}}`,
);

/**
 * The checklist's progress, less its rounded ends: done in green, then work in progress in a
 * lighter green. The drawing is wider than any band and stretches to the box it gets, so it fills
 * the rest of the row.
 */
function barSvg({ done, inProgress, total }: Progress) {
  const WIDTH = 4000;
  const at = (count: number) => (total ? Math.round((count / total) * WIDTH) : 0);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="6" viewBox="0 0 ${WIDTH} 6" preserveAspectRatio="none">`,
    BAR_STYLE,
    `<rect class="t" width="${WIDTH}" height="6"/>`,
    `<rect class="d" width="${at(done)}" height="6"/>`,
    `<rect class="p" x="${at(done)}" width="${at(done + inProgress) - at(done)}" height="6"/>`,
    "</svg>",
  ].join("");
}

/** The parts the bar starts and ends on, which its rounded ends take the color of. */
function barEnds({ done, inProgress, total }: Progress): { left: BarPart; right: BarPart } {
  const left = done ? "d" : inProgress ? "p" : "t";
  const right = !total || done + inProgress < total ? "t" : inProgress ? "p" : "d";
  return { left, right };
}

/** A group of the picker's tickets: one status, its tickets in the order they came. */
type StatusGroup = { name: string; category: Stage; tickets: WorkTicket[] };

/** Tickets grouped by status, work furthest along first, each group's sorted by team. */
function byStatus(tickets: WorkTicket[]): StatusGroup[] {
  const groups = new Map<string, StatusGroup>();
  for (const item of tickets) {
    const key = `${item.status.category}/${item.status.name}`;
    const group = groups.get(key) ?? {
      name: item.status.name,
      category: item.status.category,
      tickets: [],
    };
    group.tickets.push(item);
    groups.set(key, group);
  }
  for (const group of groups.values())
    group.tickets.sort((a, b) => teamKey(a).localeCompare(teamKey(b)));
  return [...groups.values()].sort(
    (a, b) => GROUP_ORDER.indexOf(a.category) - GROUP_ORDER.indexOf(b.category),
  );
}

/** A ticket's team key, which leads its ID: `WEB` of `WEB-31`. */
function teamKey(item: WorkTicket) {
  return item.identifier.slice(0, item.identifier.lastIndexOf("-"));
}

function itemState(item: ViewItem): ItemState {
  return item.done ? "done" : item.inProgress ? "in_progress" : "not_started";
}

/**
 * The checkbox's parts: its empty outline, filled green when done, and in progress tinted with a
 * square in the bar's lighter green.
 */
const ITEM_STYLE = websiteStyle(
  (colors) =>
    `.o{fill:none;stroke:${colors.muted};stroke-opacity:.6}.d{fill:${colors.success}}.p{fill:${colors.started};fill-opacity:.35;stroke:${colors.started}}.s{fill:${colors.started}}.c{fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}`,
);

/**
 * A checklist item's checkbox as the website draws it: a 16-pixel rounded square, with Lucide's
 * check when done and a small square while in progress.
 */
function itemSvg(state: ItemState) {
  const inside =
    state === "done"
      ? '<rect class="d" width="16" height="16" rx="4"/><path class="c" transform="translate(1 1) scale(.5833)" d="M20 6 9 17l-5-5"/>'
      : state === "in_progress"
        ? '<rect class="p" x=".5" y=".5" width="15" height="15" rx="3.5"/><rect class="s" x="4" y="4" width="8" height="8" rx="2"/>'
        : '<rect class="o" x=".5" y=".5" width="15" height="15" rx="3.5"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">${ITEM_STYLE}${inside}</svg>`;
}

/** One rounded end of the bar: a half circle as tall as the bar. */
function capSvg(side: "left" | "right", part: BarPart) {
  const half = side === "left" ? "M3 0A3 3 0 0 0 3 6Z" : "M0 0A3 3 0 0 1 0 6Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="3" height="6" viewBox="0 0 3 6">${BAR_STYLE}<path class="${part}" d="${half}"/></svg>`;
}
