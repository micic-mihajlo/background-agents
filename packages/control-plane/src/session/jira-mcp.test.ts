import { describe, expect, it } from "vitest";
import {
  ATLASSIAN_ROVO_MCP_URL,
  JIRA_MCP_SERVER_NAME,
  type McpServerConfig,
} from "@open-inspect/shared/types/integrations";
import type { SqlDatabase } from "../db/sql-database";
import {
  JIRA_MCP_SERVER_ID,
  buildJiraAuthorizationHeader,
  buildJiraMcpServer,
  resolveJiraMcpServer,
  withJiraMcpServer,
} from "./jira-mcp";

function userServer(name: string): McpServerConfig {
  return { id: `id-${name}`, name, type: "remote", url: "https://mcp.example.com", enabled: true };
}

describe("buildJiraAuthorizationHeader", () => {
  it("encodes a personal token as Basic email:token", () => {
    const header = buildJiraAuthorizationHeader({
      authType: "basic",
      email: "dev@stan.example",
      apiToken: "tok",
    });
    expect(header).toBe(`Basic ${btoa("dev@stan.example:tok")}`);
  });

  it("encodes non-Latin-1 characters as UTF-8 instead of throwing", () => {
    const header = buildJiraAuthorizationHeader({
      authType: "basic",
      email: "dev@stan.example",
      apiToken: "tök✓",
    });
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(header.slice("Basic ".length)), (c) => c.charCodeAt(0))
    );
    expect(decoded).toBe("dev@stan.example:tök✓");
  });

  it("sends a service account key as Bearer", () => {
    expect(buildJiraAuthorizationHeader({ authType: "bearer", apiToken: "sa-key" })).toBe(
      "Bearer sa-key"
    );
  });
});

describe("buildJiraMcpServer", () => {
  it("targets the Rovo MCP endpoint as a remote server", () => {
    expect(buildJiraMcpServer({ authType: "bearer", apiToken: "sa-key" })).toEqual({
      id: JIRA_MCP_SERVER_ID,
      name: JIRA_MCP_SERVER_NAME,
      type: "remote",
      url: ATLASSIAN_ROVO_MCP_URL,
      headers: { Authorization: "Bearer sa-key" },
      repoScopes: null,
      enabled: true,
    });
  });
});

describe("withJiraMcpServer", () => {
  const jira = buildJiraMcpServer({ authType: "bearer", apiToken: "sa-key" });

  it("appends the Jira server", () => {
    expect(withJiraMcpServer([userServer("linear")], jira).map((s) => s.name)).toEqual([
      "linear",
      JIRA_MCP_SERVER_NAME,
    ]);
  });

  it("returns servers unchanged when Jira does not apply", () => {
    const servers = [userServer("linear")];
    expect(withJiraMcpServer(servers, null)).toBe(servers);
  });

  it("keeps a user-configured server with the same name", () => {
    const servers = [userServer(JIRA_MCP_SERVER_NAME)];
    expect(withJiraMcpServer(servers, jira)).toEqual(servers);
  });
});

describe("resolveJiraMcpServer", () => {
  it("returns null instead of throwing when settings cannot be read", async () => {
    const db = {
      prepare: () => {
        throw new Error("D1 unavailable");
      },
    } as unknown as SqlDatabase;
    const credentials = { get: async () => ({ authType: "bearer" as const, apiToken: "k" }) };

    await expect(
      resolveJiraMcpServer(db, credentials, [{ repoOwner: "acme", repoName: "web" }])
    ).resolves.toBeNull();
  });
});
