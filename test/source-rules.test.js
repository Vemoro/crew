import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

test("Codegröße und Abstandsraster unterscheiden Grenzwerte von gültigen Ausnahmen", t => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-source-check-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet"], { cwd });
  const check = fileURLToPath(new URL("../scripts/check-source.mjs", import.meta.url));
  const run = () => spawnSync(process.execPath, [check], { cwd, encoding: "utf8" });
  const write = (path, content) => writeFileSync(join(cwd, path), content);
  write("source.js", "// eine Zeile\n".repeat(400));
  write("form.css", `main { gap: 8px; border: 1px solid; margin: auto } /* padding: 3px */
    main::after { content: "; gap: 6px"; --test: padding: 3px; }
    @supports (gap: 3px) { main { gap: 4px } }`);
  mkdirSync(join(cwd, "test"));
  write("test/source.test.js", "// eine Testzeile\n".repeat(401));
  assert.equal(run().status, 0);
  write("source.js", "// eine Zeile\n".repeat(401));
  write("form.css", "main { margin: calc(8px - 2px); gap: 6px; border: 1px solid }");
  const rejected = run();
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /source\.js: 401 Zeilen/);
  assert.match(rejected.stderr, /margin: calc\(8px - 2px\)/);
  assert.match(rejected.stderr, /gap: 6px/);
  assert.doesNotMatch(rejected.stderr, /border|source\.test\.js/);
});
