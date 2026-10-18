const root = new URL("../src/", import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const relative = specifier.slice(2);
    const withExtension = relative.endsWith(".ts") ? relative : `${relative}.ts`;
    return nextResolve(new URL(withExtension, root).href, context);
  }
  return nextResolve(specifier, context);
}
