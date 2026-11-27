import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

const paths = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" });
const source = /\.(?:[cm]?[jt]sx?|css)$/;
const tests = /^(?:test|tests)\/|\.(?:test|spec)\.[^.]+$|^scripts\/check-browser\.mjs$/;
const spacingProperties = /(?:^|(?<=[{};]))\s*((?:padding|margin)(?:-[a-z-]+)?|gap|row-gap|column-gap)\s*:\s*([^;{}]+)/gi;
const pixels = /(?<![\w.-])([+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?)px\b/gi;
const commentsAndStrings = /\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g;
const newline = /\r\n|[\r\n\u2028\u2029]/;

// Tokenzählung nach Vemoro/desk, scripts/check-code-size.ts (AGPL-3.0-only).
const nonCodeTokens = new Set([
  ts.SyntaxKind.EndOfFileToken, ts.SyntaxKind.JsxText, ts.SyntaxKind.JsxTextAllWhiteSpaces,
  ts.SyntaxKind.OpenBraceToken, ts.SyntaxKind.CloseBraceToken, ts.SyntaxKind.CloseParenToken,
  ts.SyntaxKind.CloseBracketToken, ts.SyntaxKind.CommaToken, ts.SyntaxKind.SemicolonToken,
  ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail,
]);

function checkFunctions(path, content) {
  const file = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) {
      const lines = new Set();
      function count(part) {
        if (ts.isJSDoc(part)) return;
        const children = part.getChildren(file);
        if (children.length) children.forEach(count);
        else if (part.kind >= ts.SyntaxKind.FirstToken && part.kind <= ts.SyntaxKind.LastToken && !nonCodeTokens.has(part.kind)) {
          lines.add(file.getLineAndCharacterOfPosition(part.getStart(file)).line);
        }
      }
      count(node.body);
      if (lines.size > 80) {
        const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
        console.error(`${path}:${line}: Funktion mit ${lines.size} Codezeilen, höchstens 80 erlaubt.`);
        process.exitCode = 1;
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}

for (const path of new Set(paths.split("\0"))) {
  if (!source.test(path) || tests.test(path) || /(?:^|\/)routeTree\.gen\.ts$|\.d\.[cm]?ts$/.test(path) || !existsSync(path)) continue;
  const content = readFileSync(path, "utf8");
  const lines = content ? content.split(newline).length - Number(/[\r\n\u2028\u2029]$/.test(content)) : 0;
  if (lines > 400) {
    console.error(`${path}: ${lines} Zeilen, höchstens 400 erlaubt.`);
    process.exitCode = 1;
  }
  if (!path.endsWith(".css")) {
    checkFunctions(path, content);
    continue;
  }
  const code = content.replace(commentsAndStrings, fragment => fragment.replace(/[^\n]/g, " "));
  for (const match of code.matchAll(spacingProperties)) {
    if (![...match[2].matchAll(pixels)].some(([, number]) => Number(number) % 4 !== 0)) continue;
    const offset = match.index + match[0].indexOf(match[1]);
    const line = code.slice(0, offset).split(newline).length;
    console.error(`${path}:${line}: ${match[1]}: ${match[2].trim()} liegt außerhalb des 4-Pixel-Rasters.`);
    process.exitCode = 1;
  }
}
