#!/bin/sh
# Clanker Ship plugin hook: reports the session, names its ticket, binds the ticket of a ticket
# call and hands the clanker its new Clanker Ship messages through `clanker hook`. Until the CLI
# is installed, or if it fails, it does nothing, so a hook never stops the session.
# Usage: hook.sh <session-start|prompt|tool|stop> <claude|codex|cursor>
EVENT="$1"
CLIENT="$2"
# In a Clanker Ship checkout, `pnpm plugin:dev` writes .dev/clanker: the checkout's own CLI.
DEV="$(cd "$(dirname "$0")/.." && pwd)/.dev/clanker"
if [ -x "$DEV" ]; then
  "$DEV" hook "$EVENT" --client "$CLIENT" 2>/dev/null
  exit 0
fi
case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*)
    PREFIX="$(cygpath -u "$LOCALAPPDATA" 2>/dev/null || echo "$LOCALAPPDATA")/Clanker"
    CLI="$PREFIX/bin/clanker.cmd"
    APP="$PREFIX/app/current"
    ;;
  *)
    CLI="$HOME/.local/bin/clanker"
    APP="$HOME/.local/share/clanker/app/current"
    ;;
esac
[ -s "$APP" ] && [ -x "$CLI" ] || exit 0
"$CLI" hook "$EVENT" --client "$CLIENT" 2>/dev/null
exit 0
