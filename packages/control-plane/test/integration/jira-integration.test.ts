import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import type { JiraCredentialsStatus } from "@open-inspect/shared/types/integrations";
import { JiraCredentialStore } from "../../src/db/jira-credentials";
import { IntegrationSettingsStore } from "../../src/db/integration-settings";
import { resolveJiraEnabled, resolveJiraMcpServer } from "../../src/session/jira-mcp";
import { cleanD1Tables } from "./cleanup";
import { serviceFetch } from "./helpers";

const CREDENTIALS_URL = "https://test.local/integration-settings/jira/credentials";

function credentialStore() {
  return new JiraCredentialStore(env.DB, env.REPO_SECRETS_ENCRYPTION_KEY!);
}

const acmeWeb = { repoOwner: "acme", repoName: "web" };
const acmeApi = { repoOwner: "acme", repoName: "api" };

describe("Jira integration", () => {
  beforeEach(cleanD1Tables);

  describe("credentials API", () => {
    it("reports not configured before credentials are saved", async () => {
      const response = await serviceFetch(CREDENTIALS_URL);
      expect(response.status).toBe(200);
      const body = await response.json<{ credentials: JiraCredentialsStatus }>();
      expect(body.credentials).toEqual({
        configured: false,
        authType: null,
        email: null,
        updatedAt: null,
      });
    });

    it("stores credentials encrypted and never returns the token", async () => {
      const put = await serviceFetch(CREDENTIALS_URL, {
        method: "PUT",
        body: JSON.stringify({
          credentials: { authType: "basic", email: "dev@stan.example", apiToken: "super-secret" },
        }),
      });
      expect(put.status).toBe(200);
      expect(await put.text()).not.toContain("super-secret");

      const get = await serviceFetch(CREDENTIALS_URL);
      const raw = await get.text();
      expect(raw).not.toContain("super-secret");
      const status = (JSON.parse(raw) as { credentials: JiraCredentialsStatus }).credentials;
      expect(status).toMatchObject({
        configured: true,
        authType: "basic",
        email: "dev@stan.example",
      });

      const row = await env.DB.prepare(
        "SELECT credentials FROM integration_credentials WHERE integration_id = 'jira'"
      ).first<{ credentials: string }>();
      expect(row?.credentials).toBeTruthy();
      expect(row?.credentials).not.toContain("super-secret");
      expect(await credentialStore().get()).toEqual({
        authType: "basic",
        email: "dev@stan.example",
        apiToken: "super-secret",
      });
    });

    it("replaces and deletes credentials", async () => {
      await credentialStore().set({ authType: "basic", email: "a@b.co", apiToken: "old" });

      await serviceFetch(CREDENTIALS_URL, {
        method: "PUT",
        body: JSON.stringify({ credentials: { authType: "bearer", apiToken: "new" } }),
      });
      expect(await credentialStore().get()).toEqual({ authType: "bearer", apiToken: "new" });

      const del = await serviceFetch(CREDENTIALS_URL, { method: "DELETE" });
      expect(del.status).toBe(200);
      expect(await credentialStore().get()).toBeNull();
    });

    it.each([
      ["missing credentials object", {}],
      ["basic without email", { credentials: { authType: "basic", apiToken: "t" } }],
      ["invalid email", { credentials: { authType: "basic", email: "nope", apiToken: "t" } }],
      ["blank token", { credentials: { authType: "bearer", apiToken: "   " } }],
      ["unknown auth type", { credentials: { authType: "oauth", apiToken: "t" } }],
      ["unknown field", { credentials: { authType: "bearer", apiToken: "t", extra: 1 } }],
    ])("rejects %s", async (_name, body) => {
      const response = await serviceFetch(CREDENTIALS_URL, {
        method: "PUT",
        body: JSON.stringify(body),
      });
      expect(response.status).toBe(400);
      expect(await credentialStore().get()).toBeNull();
    });

    it("rejects credentials for integrations without a credential store", async () => {
      const response = await serviceFetch(
        "https://test.local/integration-settings/vnc/credentials"
      );
      expect(response.status).toBe(400);
    });

    it("returns 404 for unknown integrations", async () => {
      const response = await serviceFetch(
        "https://test.local/integration-settings/nope/credentials"
      );
      expect(response.status).toBe(404);
    });
  });

  describe("session resolution", () => {
    const settings = () => new IntegrationSettingsStore(env.DB);

    it("is disabled by default", async () => {
      expect(await resolveJiraEnabled(env.DB, [acmeWeb])).toBe(false);
      expect(await resolveJiraEnabled(env.DB, [])).toBe(false);
    });

    it("applies to every repository and repo-less sessions when enabled globally", async () => {
      await settings().setGlobal("jira", { defaults: { enabled: true } });
      expect(await resolveJiraEnabled(env.DB, [acmeWeb])).toBe(true);
      expect(await resolveJiraEnabled(env.DB, [])).toBe(true);
    });

    it("honors the repository allowlist and excludes repo-less sessions", async () => {
      await settings().setGlobal("jira", {
        defaults: { enabled: true },
        enabledRepos: ["acme/web"],
      });
      expect(await resolveJiraEnabled(env.DB, [acmeWeb])).toBe(true);
      expect(await resolveJiraEnabled(env.DB, [acmeApi])).toBe(false);
      expect(await resolveJiraEnabled(env.DB, [])).toBe(false);
    });

    it("applies when any member enables it", async () => {
      await settings().setGlobal("jira", { defaults: { enabled: false } });
      await settings().setRepoSettings("jira", "acme/api", { enabled: true });
      expect(await resolveJiraEnabled(env.DB, [acmeWeb])).toBe(false);
      expect(await resolveJiraEnabled(env.DB, [acmeWeb, acmeApi])).toBe(true);
    });

    it("builds the MCP server only when enabled and credentials exist", async () => {
      await settings().setGlobal("jira", { defaults: { enabled: true } });
      expect(await resolveJiraMcpServer(env.DB, credentialStore(), [acmeWeb])).toBeNull();

      await credentialStore().set({ authType: "bearer", apiToken: "sa-key" });
      const server = await resolveJiraMcpServer(env.DB, credentialStore(), [acmeWeb]);
      expect(server).toMatchObject({
        type: "remote",
        headers: { Authorization: "Bearer sa-key" },
      });

      await settings().setRepoSettings("jira", "acme/web", { enabled: false });
      expect(await resolveJiraMcpServer(env.DB, credentialStore(), [acmeWeb])).toBeNull();
    });
  });

  it("exposes resolved config for jira", async () => {
    await new IntegrationSettingsStore(env.DB).setGlobal("jira", {
      defaults: { enabled: true },
    });
    const response = await serviceFetch(
      "https://test.local/integration-settings/jira/resolved/acme/web"
    );
    expect(response.status).toBe(200);
    const body = await response.json<{ config: { enabled: boolean } }>();
    expect(body.config).toEqual({ enabled: true, enabledRepos: null });
  });
});
