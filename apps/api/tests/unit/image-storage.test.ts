import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  parseManagedImageUrl,
  resolveManagedFile,
} from "../../src/modules/uploads/image-storage.js";
import { loadEnv } from "../../src/config/env.js";
import { baseTestEnvVars } from "../helpers/test-env.js";

const uploadDir = path.join("C:\\temp", "nesma-upload-test");
const env = loadEnv({
  ...baseTestEnvVars,
  UPLOAD_DIR: uploadDir,
  API_PUBLIC_URL: "http://localhost:4000",
});

const catalogName = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg";

describe("managed image paths", () => {
  it("accepts generated catalog and avatar names inside the upload directory", () => {
    expect(resolveManagedFile(env, "catalog", catalogName)).toBe(
      path.resolve(uploadDir, "catalog", catalogName),
    );
    expect(resolveManagedFile(env, "avatars", "12.png")).toBe(
      path.resolve(uploadDir, "avatars", "12.png"),
    );
  });

  it("rejects traversal, extra segments, and client filenames", () => {
    expect(resolveManagedFile(env, "catalog", "../avatars/1.jpg")).toBeNull();
    expect(resolveManagedFile(env, "catalog", "..\\..\\win.ini")).toBeNull();
    expect(resolveManagedFile(env, "catalog", "photo.jpg")).toBeNull();
    expect(resolveManagedFile(env, "avatars", "0.png")).toBeNull();
    expect(resolveManagedFile(env, "avatars", "1.jpg.png")).toBeNull();
  });

  it("only parses URLs this API issued", () => {
    const owned = `http://localhost:4000/api/v1/media/catalog/${catalogName}`;
    expect(parseManagedImageUrl(env, owned)?.filename).toBe(catalogName);
    expect(
      parseManagedImageUrl(env, "https://cdn.example.com/catalog/photo.jpg"),
    ).toBeNull();
    expect(
      parseManagedImageUrl(
        env,
        "http://localhost:4000/api/v1/media/catalog/../secret.jpg",
      ),
    ).toBeNull();
    expect(
      parseManagedImageUrl(env, "http://evil.example/api/v1/media/catalog/" + catalogName),
    ).toBeNull();
  });
});
