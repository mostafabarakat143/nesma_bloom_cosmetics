import { describe, expect, it } from "vitest";

import { detectImage } from "../../src/modules/uploads/image-file.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("detectImage", () => {
  it("accepts JPEG, PNG, and WebP from the file header", () => {
    const jpeg = Buffer.alloc(16, 0);
    jpeg[0] = 0xff;
    jpeg[1] = 0xd8;
    jpeg[2] = 0xff;

    const webp = Buffer.alloc(16, 0);
    webp.write("RIFF", 0, "ascii");
    webp.write("WEBP", 8, "ascii");

    expect(detectImage(jpeg)).toEqual({
      ext: "jpg",
      contentType: "image/jpeg",
    });
    expect(detectImage(PNG)).toEqual({
      ext: "png",
      contentType: "image/png",
    });
    expect(detectImage(webp)).toEqual({
      ext: "webp",
      contentType: "image/webp",
    });
  });

  it("rejects SVG, GIF, and short buffers", () => {
    expect(
      detectImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")),
    ).toBeNull();
    expect(detectImage(Buffer.from("GIF89a........"))).toBeNull();
    expect(detectImage(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});
