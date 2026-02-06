import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { buildAnthropicProvider, resolveImplicitProviders } from "./models-config.providers.js";
import { upsertAuthProfile } from "./auth-profiles.js";

describe("Anthropic provider", () => {
  let agentDir: string;

  beforeEach(() => {
    delete process.env.ANTHROPIC_BASE_URL;
    agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
  });

  describe("buildAnthropicProvider", () => {
    it("should use default base URL when no custom URL is provided", () => {
      const provider = buildAnthropicProvider();
      expect(provider.baseUrl).toBe("https://api.anthropic.com");
      expect(provider.api).toBe("anthropic-messages");
      expect(provider.models).toEqual([]);
    });

    it("should use custom base URL from parameter", () => {
      const provider = buildAnthropicProvider({
        baseUrl: "https://custom.anthropic.example.com",
      });
      expect(provider.baseUrl).toBe("https://custom.anthropic.example.com");
      expect(provider.api).toBe("anthropic-messages");
    });

    it("should use ANTHROPIC_BASE_URL env var when provided", () => {
      process.env.ANTHROPIC_BASE_URL = "https://env.anthropic.example.com";
      const provider = buildAnthropicProvider();
      expect(provider.baseUrl).toBe("https://env.anthropic.example.com");
    });

    it("should prefer parameter over env var", () => {
      process.env.ANTHROPIC_BASE_URL = "https://env.anthropic.example.com";
      const provider = buildAnthropicProvider({
        baseUrl: "https://param.anthropic.example.com",
      });
      expect(provider.baseUrl).toBe("https://param.anthropic.example.com");
    });

    it("should trim whitespace from base URL", () => {
      const provider = buildAnthropicProvider({
        baseUrl: "  https://custom.anthropic.example.com  ",
      });
      expect(provider.baseUrl).toBe("https://custom.anthropic.example.com");
    });
  });

  describe("resolveImplicitProviders", () => {
    it("should not include anthropic provider when no custom base URL is configured", async () => {
      const providers = await resolveImplicitProviders({ agentDir });
      expect(providers?.anthropic).toBeUndefined();
    });

    it("should include anthropic provider when ANTHROPIC_BASE_URL env var is set", async () => {
      process.env.ANTHROPIC_BASE_URL = "https://custom.anthropic.example.com";
      try {
        const providers = await resolveImplicitProviders({ agentDir });
        expect(providers?.anthropic).toBeDefined();
        expect(providers?.anthropic?.baseUrl).toBe("https://custom.anthropic.example.com");
        expect(providers?.anthropic?.api).toBe("anthropic-messages");
      } finally {
        delete process.env.ANTHROPIC_BASE_URL;
      }
    });

    it("should include anthropic provider when profile has custom baseUrl metadata", async () => {
      upsertAuthProfile({
        profileId: "anthropic:default",
        agentDir,
        credential: {
          type: "api_key",
          provider: "anthropic",
          key: "sk-ant-test-key",
          metadata: {
            baseUrl: "https://profile.anthropic.example.com",
          },
        },
      });

      const providers = await resolveImplicitProviders({ agentDir });
      expect(providers?.anthropic).toBeDefined();
      expect(providers?.anthropic?.baseUrl).toBe("https://profile.anthropic.example.com");
      expect(providers?.anthropic?.api).toBe("anthropic-messages");
    });

    it("should prefer env var over profile metadata for baseUrl", async () => {
      process.env.ANTHROPIC_BASE_URL = "https://env.anthropic.example.com";
      upsertAuthProfile({
        profileId: "anthropic:default",
        agentDir,
        credential: {
          type: "api_key",
          provider: "anthropic",
          key: "sk-ant-test-key",
          metadata: {
            baseUrl: "https://profile.anthropic.example.com",
          },
        },
      });

      try {
        const providers = await resolveImplicitProviders({ agentDir });
        expect(providers?.anthropic).toBeDefined();
        expect(providers?.anthropic?.baseUrl).toBe("https://env.anthropic.example.com");
      } finally {
        delete process.env.ANTHROPIC_BASE_URL;
      }
    });

    it("should use baseUrl from first profile with metadata when multiple profiles exist", async () => {
      upsertAuthProfile({
        profileId: "anthropic:custom",
        agentDir,
        credential: {
          type: "api_key",
          provider: "anthropic",
          key: "sk-ant-test-key-2",
          metadata: {
            baseUrl: "https://custom.anthropic.example.com",
          },
        },
      });

      upsertAuthProfile({
        profileId: "anthropic:default",
        agentDir,
        credential: {
          type: "api_key",
          provider: "anthropic",
          key: "sk-ant-test-key",
          metadata: {},
        },
      });

      const providers = await resolveImplicitProviders({ agentDir });
      expect(providers?.anthropic).toBeDefined();
      expect(providers?.anthropic?.baseUrl).toBe("https://custom.anthropic.example.com");
    });

    it("should not include anthropic provider when profile has no baseUrl metadata", async () => {
      upsertAuthProfile({
        profileId: "anthropic:default",
        agentDir,
        credential: {
          type: "api_key",
          provider: "anthropic",
          key: "sk-ant-test-key",
        },
      });

      const providers = await resolveImplicitProviders({ agentDir });
      expect(providers?.anthropic).toBeUndefined();
    });
  });
});
