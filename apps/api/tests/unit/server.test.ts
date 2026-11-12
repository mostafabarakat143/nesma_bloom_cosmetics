import { createServer, type Server } from "node:http";

import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: { PORT: 0 },
  prisma: {},
  logger: { info: vi.fn(), error: vi.fn(), fatal: vi.fn() },
  createApp: vi.fn(),
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
  startCleanup: vi.fn(),
  stopCleanup: vi.fn(),
}));

vi.mock("dotenv/config", () => ({}));
vi.mock("../../src/app.js", () => ({ createApp: mocks.createApp }));
vi.mock("../../src/config/env.js", () => ({ loadEnv: () => mocks.env }));
vi.mock("../../src/config/logger.js", () => ({ createLogger: () => mocks.logger }));
vi.mock("../../src/config/database.js", () => ({
  createPrismaClient: () => mocks.prisma,
  connectDatabase: mocks.connectDatabase,
  disconnectDatabase: mocks.disconnectDatabase,
}));
vi.mock("../../src/modules/auth/revocation-cleanup.js", () => ({
  startRevocationCleanup: mocks.startCleanup,
}));

let server: Server | undefined;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.env.PORT = 0;
  mocks.connectDatabase.mockResolvedValue(undefined);
  mocks.disconnectDatabase.mockResolvedValue(undefined);
  mocks.startCleanup.mockReturnValue(mocks.stopCleanup);
  mocks.createApp.mockImplementation(() => {
    const app = express();
    const listen = app.listen.bind(app);
    app.listen = ((port: number, callback: (error?: Error) => void) => {
      server = listen(port, callback);
      return server;
    }) as typeof app.listen;
    return app;
  });
  vi.spyOn(process, "on").mockReturnValue(process);
  vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  vi.spyOn(console, "error").mockImplementation(() => { });
});

afterEach(async () => {
  if (server?.listening) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => error ? reject(error) : resolve());
    });
  }
  server = undefined;
});

describe("HTTP server startup", () => {
  it("announces readiness only after the HTTP server is listening", async () => {
    await import("../../src/server.js");
    await vi.waitFor(() => expect(mocks.logger.info).toHaveBeenCalled());

    expect(server?.listening).toBe(true);
    expect(mocks.stopCleanup).not.toHaveBeenCalled();
    expect(mocks.disconnectDatabase).not.toHaveBeenCalled();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("cleans up and exits unsuccessfully when the port is already in use", async () => {
    const occupied = createServer();
    await new Promise<void>((resolve) => occupied.listen(0, resolve));
    const address = occupied.address();
    if (!address || typeof address === "string") throw new Error("Missing test address");
    mocks.env.PORT = address.port;

    try {
      await import("../../src/server.js");
      await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(1));

      expect(mocks.stopCleanup).toHaveBeenCalledTimes(1);
      expect(mocks.disconnectDatabase).toHaveBeenCalledExactlyOnceWith(mocks.prisma, mocks.logger);
      expect(mocks.logger.fatal).toHaveBeenCalledWith(
        { err: expect.objectContaining({ code: "EADDRINUSE" }) },
        "API server startup failed",
      );
      expect(mocks.logger.info).not.toHaveBeenCalled();
      expect(mocks.disconnectDatabase.mock.invocationCallOrder[0])
        .toBeLessThan(vi.mocked(process.exit).mock.invocationCallOrder[0]!);
    } finally {
      await new Promise<void>((resolve) => occupied.close(() => resolve()));
    }
  });

  it("also releases resources when listen throws synchronously", async () => {
    const failure = new Error("Synchronous listen failure");
    mocks.createApp.mockReturnValue({ listen: () => { throw failure; } });

    await import("../../src/server.js");
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(1));

    expect(mocks.stopCleanup).toHaveBeenCalledTimes(1);
    expect(mocks.disconnectDatabase).toHaveBeenCalledTimes(1);
    expect(mocks.logger.fatal).toHaveBeenCalledWith({ err: failure }, "API server startup failed");
    expect(mocks.logger.info).not.toHaveBeenCalled();
  });

  it("disconnects after a database startup failure without starting cleanup", async () => {
    mocks.connectDatabase.mockRejectedValueOnce(new Error("Database startup failure"));

    await import("../../src/server.js");
    await vi.waitFor(() => expect(process.exit).toHaveBeenCalledWith(1));

    expect(mocks.startCleanup).not.toHaveBeenCalled();
    expect(mocks.disconnectDatabase).toHaveBeenCalledTimes(1);
    expect(mocks.createApp).not.toHaveBeenCalled();
  });
});
