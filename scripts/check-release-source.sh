#!/usr/bin/env bash
set -euo pipefail

package=$(cd "$1" && pwd)
temp_root=$(cd "${TMPDIR:-/tmp}" && pwd -P)
workspace=$(mktemp -d "$temp_root/crew-package.XXXXXX")
project="crew-package-$(bun -e 'console.log(crypto.randomUUID().slice(0, 8))')"
compose_file=
cleanup() {
  if [[ -n "$compose_file" ]]; then
    docker compose -f "$compose_file" -p "$project" down -v --remove-orphans --rmi local
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

crew_password=$(bun -e 'console.log(crypto.randomUUID())')
export CREW_DB_PASSWORD="$(bun -e 'console.log(crypto.randomUUID())')"
export CREW_AUTH_SECRET="$(bun -e 'console.log(crypto.randomUUID())')"
export CREW_ORIGIN=http://localhost:8080
export CREW_PORT=0
export CREW_REGISTRATION=paused
export CREW_TRUSTED_PROXY=
compose_file="$PWD/compose.yaml"
docker compose -f "$compose_file" -p "$project" up --build -d
crew_address="http://$(docker compose -f "$compose_file" -p "$project" port crew 8080)"
curl --fail --silent --show-error --retry 5 --retry-all-errors --max-time 5 "$crew_address/ready" >/dev/null
CREW_ADMIN_PASSWORD="$crew_password" docker compose -f "$compose_file" -p "$project" run --rm \
  -e CREW_ADMIN_PASSWORD crew bun run admin dispo@example.test "Crew Dispo"
CREW_SMOKE_ADDRESS="$crew_address" CREW_SMOKE_PASSWORD="$crew_password" bun - <<'BUN'
import assert from 'node:assert/strict';
const origin = process.env.CREW_ORIGIN;
const address = process.env.CREW_SMOKE_ADDRESS;
const response = await fetch(address + '/anmelden', {
  method: 'POST',
  headers: { origin },
  redirect: 'manual',
  body: new URLSearchParams({ email: 'dispo@example.test', password: process.env.CREW_SMOKE_PASSWORD }),
});
assert.equal(response.status, 303);
assert.equal(response.headers.get('location'), '/dispo');
const cookie = response.headers.get('set-cookie').split(';')[0];
const panel = await fetch(address + '/dispo', { headers: { cookie } });
assert.match(await panel.text(), /Personal und Einsätze/);
BUN
