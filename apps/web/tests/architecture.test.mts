import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const src = fileURLToPath(new URL("../src/", import.meta.url));
function filesIn(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? filesIn(file) : /\.(ts|tsx)$/.test(file) ? [file] : [];
  });
}

test("HTTP requests are owned by feature services or shared transports", () => {
  const violations: string[] = [];
  for (const file of filesIn(src)) {
    const relative = path.relative(src, file).replaceAll("\\", "/");
    if (relative.includes("/services/") || relative.startsWith("shared/http/")) continue;
    const syntax = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ["fetch", "requestJson", "requestFile", "callExpress"].includes(node.expression.getText(syntax))) {
        violations.push(relative);
      }
      ts.forEachChild(node, visit);
    }
    visit(syntax);
  }
  assert.deepEqual(violations, [], "Move endpoint calls into feature services.");
});

test("client UI imports hooks and contracts rather than server or browser services", () => {
  const violations: string[] = [];
  for (const file of filesIn(src).filter((file) => file.includes(`${path.sep}components${path.sep}`))) {
    const source = fs.readFileSync(file, "utf8");
    if (!source.startsWith('"use client";')) continue;
    const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const node of syntax.statements) {
      if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      if (!node.moduleSpecifier.text.includes("/services/")) continue;
      const imports = node.importClause;
      if (imports?.isTypeOnly) continue;
      if (imports?.namedBindings && ts.isNamedImports(imports.namedBindings) && imports.namedBindings.elements.every((entry) => entry.isTypeOnly)) continue;
      violations.push(path.relative(src, file));
    }
  }
  assert.deepEqual(violations, []);
});
