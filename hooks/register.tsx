import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";
import type { PaneTab, Stage, View, ViewTicket, WorkTicket } from "./state";

// Clanker Ship in Claude Code: a band above the prompt with the session's ticket, a pane with
// its checklist and the person's other work, the turn's changes on the band, and messages that
// start a turn. Its data comes from `clanker session connect`, which holds the session's
// connection to Clanker Ship and prints one JSON line per change.

const PANE = "clanker-ship";

const view = atom({ plugin: "clanker-ship", key: "view" } as const, null);
const connected = atom({ plugin: "clanker-ship", key: "connected" } as const, false);
const turn = atom({ plugin: "clanker-ship", key: "turn" } as const, null);
const hidden = atom({ plugin: "clanker-ship", key: "hidden" } as const, false);
const tab = atom({ plugin: "clanker-ship", key: "tab" } as const, "ticket");
const notice = atom({ plugin: "clanker-ship", key: "notice" } as const, null);

const STAGES = ["backlog", "plan", "build", "review", "ship", "done"] as const;
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
    await openPane($, "ticket");
    return { text: "Clanker Ship pane opened." };
  });

  on("command.run", { command: "work" }, async ($) => {
    await openPane($, "work");
    return { text: "Clanker Ship pane opened on My work." };
  });

  // A new turn starts: the last turn's changes leave the band. A failure never holds the prompt.
  on("prompt.submit", async ($, e, next) => {
    await update($, turn, () => null);
    return next(e);
  }).catch(($, e, next) => next(e));

  // What the turn changed on the ticket goes on the band until the next prompt.
  on("turn.complete", async ($, e, next) => {
    const done = await next(e);
    if (e.agentId === undefined && (e.reason === "answer" || e.reason === "aborted"))
      void showChanges($);
    return done;
  });

  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const current = await read($, view);
    if (e.props.hasSurvey || !current) return next(e);
    if (!current.ticket && (await read($, hidden))) return next(e);
    const { Box, Button, Text } = $.ui.resolve(e);
    const changes = await read($, turn);
    const ticket = current.ticket;
    const others = current.work.needsYou;
    const work = (
      <Button
        key="work"
        hotkey="w"
        dimColor={!others}
        label={others ? `My work · ${others} need${others === 1 ? "s" : ""} you` : "My work"}
        onPress={() => openPane($, "work")}
      />
    );
    if (!ticket)
      return (
        <Box flexDirection="column">
          <Box>
            <Text dimColor wrap="truncate-end">
              ○ No ticket for this session
            </Text>
            <Box flexGrow={1} />
            <Button
              key="hide"
              plain
              role="dismiss"
              label="×"
              onPress={() => update($, hidden, () => true)}
            />
          </Box>
          <Box gap={1}>
            <Text dimColor wrap="truncate-end">
              {current.session.branch
                ? `branch ${current.session.branch} names no ticket`
                : "no branch names a ticket"}
            </Text>
            <Box flexGrow={1} />
            <Button
              key="pick"
              hotkey="t"
              label="Pick a ticket"
              onPress={() => openPane($, "work")}
            />
            <Button
              key="file"
              hotkey="f"
              label="File one for this"
              onPress={() => $.prompt.fill({ text: "File a ticket for this work" })}
            />
          </Box>
        </Box>
      );
    const waiting = current.work.tickets.find((item) => item.here)?.needsYou ?? null;
    return (
      <Box flexDirection="column">
        <Box>
          <Text color={waiting ? "warning" : "suggestion"}>
            {STAGE_GLYPHS[ticket.status.category]}{" "}
          </Text>
          <Text weight="bold" color="suggestion">
            {ticket.identifier}
          </Text>
          <Text wrap="truncate-end"> {ticket.title}</Text>
          {waiting ? <Text color="warning"> · Needs you</Text> : null}
          <Box flexGrow={1} />
          <Text dimColor wrap="truncate-start">
            {" "}
            {track(ticket.status.category)}
          </Text>
        </Box>
        <Box gap={1}>
          {waiting ? (
            <Text color="warning" wrap="truncate-end">
              waiting on you: {waiting}
            </Text>
          ) : (
            <Box gap={1} flexShrink={1}>
              <Text color="suggestion">{meter(ticket.checklist.done, ticket.checklist.total)}</Text>
              <Text dimColor>
                {ticket.checklist.done}/{ticket.checklist.total}
              </Text>
              <Text wrap="truncate-end">
                {ticket.next ? `next: ${ticket.next}` : "no Clanker items left"}
              </Text>
            </Box>
          )}
          <Box flexGrow={1} />
          <Button key="ticket" hotkey="t" label="Ticket" onPress={() => openPane($, "ticket")} />
          {work}
        </Box>
        {changes ? (
          <Text dimColor wrap="truncate-end">
            this turn · {changes}
          </Text>
        ) : null}
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
  else if (line.type === "view") await update($, view, () => line.view);
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

/** Ends the connection and forgets what the session showed. */
async function disconnect($: EngineInterface) {
  connection?.stop();
  connection = null;
  await update($, view, () => null);
  await update($, turn, () => null);
  await update($, hidden, () => false);
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
  await update($, view, () => picked.value);
  await update($, notice, () => null);
  return `This session works on ${picked.value.ticket?.identifier ?? ticket} now.`;
}

/** Checks a Human item with the person's own sign-in: their click is their approval. */
async function check($: EngineInterface, ticket: string, item: string) {
  const checked = await run<unknown>($, ["ticket", "checklist", "check", ticket, item]);
  await update($, notice, () => (checked.ok ? null : checked.error));
}

/** Puts the turn's changes on the band. */
async function showChanges($: EngineInterface) {
  const changes = await run<{ line: string | null }>($, [
    "session",
    "changes",
    "--session",
    await $.session.id(),
  ]);
  if (changes.ok && changes.value.line) await update($, turn, () => changes.value.line);
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

/** The checklist's progress as eight cells, filled by the share done. */
function meter(done: number, total: number) {
  const filled = total ? Math.round((done / total) * 8) : 0;
  return `${"■".repeat(filled)}${"□".repeat(8 - filled)}`;
}

/** The six stages, the current one in capitals, as the website's stage track reads. */
function track(stage: Stage) {
  return STAGES.map((item) =>
    item === stage ? STAGE_LABELS[item].toUpperCase() : STAGE_LABELS[item].toLowerCase(),
  ).join(" · ");
}
