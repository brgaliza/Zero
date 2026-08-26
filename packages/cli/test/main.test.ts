import { describe, expect, it, vi } from "vitest";

import { run } from "../src/main.js";

describe("run", () => {
  it("exibe ajuda sem argumentos", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    expect(run([])).toBe(0);
    expect(write).toHaveBeenCalledWith(expect.stringContaining("Zero — fundador guiado"));

    write.mockRestore();
  });

  it("exibe a versão", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const previousVersion = process.env.ZERO_VERSION;

    try {
      process.env.ZERO_VERSION = "0.1.0";

      expect(run(["--version"])).toBe(0);
      expect(write).toHaveBeenCalledWith("0.1.0\n");
    } finally {
      if (previousVersion === undefined) {
        delete process.env.ZERO_VERSION;
      } else {
        process.env.ZERO_VERSION = previousVersion;
      }

      write.mockRestore();
    }
  });
});
