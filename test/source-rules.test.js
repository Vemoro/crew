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
  write("funktion.ts", `function demo() {\n${"void 0;\n".repeat(80)}${"// Kommentar\n".repeat(10)}}\n`);
  write("form.css", `main { gap: 8px; border: 1px solid; margin: auto } /* padding: 3px */
    main::after { content: "; gap: 6px"; --test: padding: 3px; }
    :root { --sample-6px: 8px; }
    main { gap: var(--sample-6px); }
    @supports (gap: 3px) { main { gap: 4px } }
    aside { gap: 8e0px; }`);
  mkdirSync(join(cwd, "test"));
  write("test/source.test.js", "// eine Testzeile\n".repeat(401));
  assert.equal(run().status, 0);
  write("source.js", "// eine Zeile\n".repeat(401));
  write("funktion.ts", `function demo() {\n${"void 0;\n".repeat(81)}}\n`);
  write("form.css", `main { margin: calc(8px - 2px); gap: 6px; padding: var(--space, -2px); border: 1px solid }
    aside { gap: 1e1px; margin: 3E0px; }`);
  const rejected = run();
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /source\.js: 401 Zeilen/);
  assert.match(rejected.stderr, /funktion\.ts:1: Funktion mit 81 Codezeilen/);
  assert.match(rejected.stderr, /margin: calc\(8px - 2px\)/);
  assert.match(rejected.stderr, /gap: 6px/);
  assert.match(rejected.stderr, /padding: var\(--space, -2px\)/);
  assert.match(rejected.stderr, /gap: 1e1px/);
  assert.match(rejected.stderr, /margin: 3E0px/);
  assert.doesNotMatch(rejected.stderr, /border|source\.test\.js/);
});

test("Der Rastercheck erfasst Deklarationen nach verschachtelten CSS-Blöcken", t => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-nested-css-check-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  execFileSync("git", ["init", "--quiet"], { cwd });
  const check = fileURLToPath(new URL("../scripts/check-source.mjs", import.meta.url));
  const path = join(cwd, "nested.css");
  const stylesheet = gap => `main {
    display: grid;
    @media (min-width: 1px) { color: red; }
    gap: ${gap}px;
  }`;
  writeFileSync(path, stylesheet(8));
  assert.equal(spawnSync(process.execPath, [check], { cwd }).status, 0);
  writeFileSync(path, stylesheet(6));
  const rejected = spawnSync(process.execPath, [check], { cwd, encoding: "utf8" });
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /nested\.css:4: gap: 6px/);
});
