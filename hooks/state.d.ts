// The Claude Code mod's state contract: what hooks/register.tsx keeps in $.state, and the shape
// of the session view `clanker session connect` prints (SessionView in packages/core).

export type Stage = "backlog" | "plan" | "build" | "review" | "ship" | "done" | "canceled";

export type Progress = { done: number; inProgress: number; total: number };

export type ViewTicket = {
  id: string;
  identifier: string;
  title: string;
  source: "picked" | "linked" | "branch" | "name";
  url: string;
  status: { name: string; category: Stage };
  checklist: Progress;
  next: string | null;
  items: { id: string; title: string; doer: "human" | "clanker"; done: boolean }[];
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
  work: { needsYou: number; tickets: WorkTicket[] };
};

export type PaneTab = "ticket" | "work";

declare module "claude-code" {
  interface PluginState {
    "clanker-ship": {
      /** The latest session view, null until the connection brings one. */
      view: View | null;
      /** Whether `clanker session connect` holds the connection. */
      connected: boolean;
      /** The last turn's Turn form, until the next prompt. */
      turn: string | null;
      /** The no-ticket band's ×, for the rest of the session. */
      hidden: boolean;
      /** The pane's tab. */
      tab: PaneTab;
      /** The pane's last failure, such as a check the CLI refused. */
      notice: string | null;
    };
  }
}
