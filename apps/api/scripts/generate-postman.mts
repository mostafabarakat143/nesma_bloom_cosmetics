/**
 * Convert the in-repo OpenAPI document to a Postman Collection v2.1.
 * No network calls; no secrets embedded.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { openApiDocument } from "../src/docs/openapi.js";

type PostmanItem = {
  name: string;
  request: {
    method: string;
    header: Array<{ key: string; value: string; description?: string }>;
    url: {
      raw: string;
      host: string[];
      path: string[];
      query?: Array<{ key: string; value: string }>;
    };
    body?: { mode: string; raw: string };
    description?: string;
  };
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../docs/postman");
const outFile = path.join(outDir, "Nesma-Bloom-API.postman_collection.json");

const folders = new Map<string, PostmanItem[]>();

for (const [routePath, methods] of Object.entries(openApiDocument.paths)) {
  for (const [method, operation] of Object.entries(
    methods as Record<string, { tags?: string[]; summary?: string; description?: string; parameters?: unknown[]; requestBody?: unknown }>,
  )) {
    if (!["get", "post", "patch", "put", "delete"].includes(method)) continue;
    const tag = operation.tags?.[0] ?? "API";
    const segments = routePath.replace(/^\//, "").split("/");
    const headers: PostmanItem["request"]["header"] = [];

    if (method !== "get") {
      headers.push(
        { key: "Origin", value: "{{origin}}", description: "Trusted frontend origin" },
        { key: "x-csrf-token", value: "{{csrfToken}}", description: "Copy from nb_csrf cookie" },
        { key: "Content-Type", value: "application/json" },
      );
    }

    if (routePath === "/api/v1/orders" && method === "post") {
      headers.push({
        key: "Idempotency-Key",
        value: "{{$guid}}",
        description: "Required; reuse for safe retries",
      });
    }

    const item: PostmanItem = {
      name: operation.summary ?? `${method.toUpperCase()} ${routePath}`,
      request: {
        method: method.toUpperCase(),
        header: headers,
        url: {
          raw: `{{baseUrl}}${routePath}`,
          host: ["{{baseUrl}}"],
          path: segments,
        },
        description: [
          operation.description ?? operation.summary ?? "",
          "",
          "Auth: use Postman cookie jar after login/register.",
          "Do not store real passwords or tokens in this collection.",
        ].join("\n"),
      },
    };

    if (operation.requestBody) {
      item.request.body = {
        mode: "raw",
        raw: "{\n  \n}\n",
      };
    }

    const list = folders.get(tag) ?? [];
    list.push(item);
    folders.set(tag, list);
  }
}

const collection = {
  info: {
    name: "Nesma Bloom Cosmetics API",
    description:
      "Generated from OpenAPI 3.1. Use cookie jar + CSRF. Set baseUrl and origin variables.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  variable: [
    { key: "baseUrl", value: "http://localhost:4000" },
    { key: "origin", value: "http://localhost:3000" },
    { key: "csrfToken", value: "" },
  ],
  item: [...folders.entries()].map(([name, item]) => ({ name, item })),
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
console.log(`Wrote ${outFile}`);
console.log(`Folders: ${folders.size}, requests: ${[...folders.values()].reduce((n, i) => n + i.length, 0)}`);
