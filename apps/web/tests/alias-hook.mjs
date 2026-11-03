import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../src/", import.meta.url);
const tests = new URL("./", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  let resolved;
  if (specifier.startsWith("@/")) {
    const relative = specifier.slice(2);
    const withExtension = /\.(ts|tsx)$/.test(relative) ? relative
      : [".ts", ".tsx"].map((extension) => relative + extension)
        .find((candidate) => existsSync(fileURLToPath(new URL(candidate, root)))) ?? `${relative}.ts`;
    resolved = await nextResolve(new URL(withExtension, root).href, context);
  } else {
    resolved = await nextResolve(specifier, context);
  }
  // Keep test imports of application TypeScript in ESM without changing the
  // production package's module format.
  if ((resolved.url.startsWith(root.href) || resolved.url.startsWith(tests.href)) && /\.(ts|tsx)$/.test(resolved.url)) {
    return { ...resolved, format: "module" };
  }
  return resolved;
}
