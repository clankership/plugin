// The Claude Code mod's state contract: what hooks/register.tsx keeps in $.state, and the shape
// of the session view `clanker session connect` prints (SessionView in packages/core).

export type Stage = "backlog" | "plan" | "build" | "review" | "ship" | "done" | "canceled";

export type Progress = { done: number; inProgress: number; total: number };

/** An item of the checklist for the ticket's current status: done, in progress, or not started. */
export type ViewItem = {
  id: string;
  title: string;
  doer: "human" | "clanker";
  done: boolean;
  inProgress: boolean;
};

export type ViewTicket = {
  id: string;
  identifier: string;
  title: string;
  source: "picked" | "linked" | "branch" | "name";
  url: string;
  status: { name: string; category: Stage };
  checklist: Progress;
  next: string | null;
  items: ViewItem[];
  needsHuman: { reasons: string[]; items: string[] } | null;
  documents: { name: string; slug: string; written: boolean }[];
};

export type WorkTicket = {
  id: string;
  identifier: string;
  title: string;
  url: string;
  status: { name: string; category: Stage };
  checklist: Progress;
  needsYou: string | null;
  here: boolean;
  sessions: { client: string; computer: string }[];
};

export type View = {
  session: { id: string; key: string; branch: string | null; connected: boolean };
  ticket: ViewTicket | null;
  title: string | null;
  line: string;
  /** The person's open tickets, how many of the others need them, and their My clankers page. */
  work: { needsYou: number; url: string; tickets: WorkTicket[] };
};

export type PaneTab = "ticket" | "work";

declare module "claude-code" {
  interface PluginState {
    "clanker-ship": {
      /** The latest session view, null until the connection brings one. */
      view: View | null;
      /** Whether `clanker session connect` holds the connection. */
      connected: boolean;
      /** The band's ×, until the session's ticket changes or /ticket shows it again. */
      hidden: boolean;
      /** Whether the no-ticket band shows its ticket picker. */
      picking: boolean;
      /** Whether the ticket band shows the ticket's checklist, which its chevron toggles. */
      expanded: boolean;
      /** The pane's tab. */
      tab: PaneTab;
      /** The pane's last failure, such as a check the CLI refused. */
      notice: string | null;
    };
  }
}
