#!/usr/bin/env bash
set -euo pipefail

package=$(cd "$1" && pwd)
temp_root=$(cd "${TMPDIR:-/tmp}" && pwd -P)
workspace=$(mktemp -d "$temp_root/crew-package.XXXXXX")
server_pid=
cleanup() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  case "$(cd "$workspace" && pwd -P)" in
    "$temp_root"/crew-package.*) rm -rf -- "$workspace" ;;
  esac
}
trap cleanup EXIT

cd "$package"
sha256sum --check --strict SHA256SUMS
read -r checksum archive < SHA256SUMS
test -n "$checksum"
cp -- "$archive" SHA256SUMS "$workspace"
cd "$workspace"
tar -xzf "$archive"
printf '\001' >> "$archive"
if sha256sum --check --strict SHA256SUMS >/dev/null 2>&1; then
  echo "Die veränderte Kopie hat die Prüfsummenprüfung bestanden." >&2
  exit 1
fi
cd crew-*/
test -f LICENSE
test -f CHANGELOG.md
test -f docs/installation.md

crew_password=$(node -e 'console.log(require("node:crypto").randomBytes(24).toString("hex"))')
CREW_ADMIN_PASSWORD="$crew_password" npm run admin -- dispo@example.test "Crew Dispo"
crew_port=${CREW_SMOKE_PORT:-42688}
crew_origin="http://127.0.0.1:$crew_port"
PORT="$crew_port" HOST=127.0.0.1 CREW_ORIGIN="$crew_origin" node server.js > "$workspace/server.log" 2>&1 &
server_pid=$!
curl --fail --silent --show-error --retry 5 --retry-all-errors --max-time 5 "$crew_origin/ready" >/dev/null
kill -0 "$server_pid"
CREW_ORIGIN="$crew_origin" CREW_SMOKE_PASSWORD="$crew_password" node --input-type=module - <<'NODE'
import assert from 'node:assert/strict';
const origin = process.env.CREW_ORIGIN;
const response = await fetch(origin + '/anmelden', {
  method: 'POST',
  headers: { origin },
  redirect: 'manual',
  body: new URLSearchParams({ email: 'dispo@example.test', password: process.env.CREW_SMOKE_PASSWORD }),
});
assert.equal(response.status, 303);
assert.equal(response.headers.get('location'), '/dispo');
const cookie = response.headers.get('set-cookie').split(';')[0];
const panel = await fetch(origin + '/dispo', { headers: { cookie } });
assert.match(await panel.text(), /Personal und Einsätze/);
NODE
