#!/bin/sh
# Clanker Ship plugin session hook: makes sure the standalone Clanker CLI is installed.
# Installing the plugin is the consent: its listing says it installs the CLI (about 320 MB,
# mostly Chrome). The first session starts that install in the background and says so.
# Usage: session-start.sh <claude|cursor|codex>
HOST="${1:-claude}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SITE="$(cat "$ROOT/site.txt" 2>/dev/null || echo https://clankership.com)"

case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*)
    PREFIX="$(cygpath -u "$LOCALAPPDATA" 2>/dev/null || echo "$LOCALAPPDATA")/Clanker"
    CLI="$PREFIX/bin/clanker.cmd"
    INSTALL="powershell -NoProfile -ExecutionPolicy Bypass -Command \"irm $SITE/install.ps1 | iex\""
    ;;
  *)
    PREFIX="$HOME/.local"
    CLI="$PREFIX/bin/clanker"
    INSTALL="curl -fsSL $SITE/install.sh | sh"
    ;;
esac
BIN="$PREFIX/bin"
UPDATE="$PREFIX/share/clanker/update"
LOCK="$UPDATE/plugin-install.lock"

MESSAGE=""
if [ ! -s "$PREFIX/share/clanker/app/current" ]; then
  mkdir -p "$UPDATE"
  # A lock older than 30 minutes is from an install that died.
  if [ -d "$LOCK" ] && [ -n "$(find "$LOCK" -maxdepth 0 -mmin +30 2>/dev/null)" ]; then rmdir "$LOCK"; fi
  if mkdir "$LOCK" 2>/dev/null; then
    LAST=""
    if [ -s "$UPDATE/plugin-install.log" ]; then LAST="$(tail -n 1 "$UPDATE/plugin-install.log")"; fi
    nohup sh -c "$INSTALL; rmdir '$LOCK'" >"$UPDATE/plugin-install.log" 2>&1 &
    MESSAGE="Installing the Clanker CLI (about 320 MB, mostly Chrome) in the background. clanker commands wait for it to finish."
    if [ -n "$LAST" ]; then MESSAGE="The last Clanker CLI install didn't finish ($LAST). $MESSAGE"; fi
  else
    MESSAGE="The Clanker CLI is still installing in the background. clanker commands wait for it to finish."
  fi
fi

case ":$PATH:" in
  *":$BIN:"*) ON_PATH=1 ;;
  *) ON_PATH="" ;;
esac

json() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

case "$HOST" in
  claude)
    if [ -z "$ON_PATH" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
      printf 'export PATH="%s:$PATH"\n' "$BIN" >>"$CLAUDE_ENV_FILE"
    fi
    if [ -n "$MESSAGE" ]; then
      printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$(json "$MESSAGE")" "$(json "$MESSAGE")"
    fi
    ;;
  cursor)
    printf '{"env":{"PATH":"%s"},"additional_context":"%s"}\n' "$(json "$BIN:$PATH")" "$(json "${MESSAGE:-The clanker CLI is on PATH at $CLI.}")"
    ;;
  *)
    [ -n "$MESSAGE" ] && printf '%s\n' "$MESSAGE"
    [ -z "$ON_PATH" ] && printf 'The clanker CLI is at %s; prepend %s to PATH for this session if clanker is not found.\n' "$CLI" "$BIN"
    ;;
esac
exit 0
