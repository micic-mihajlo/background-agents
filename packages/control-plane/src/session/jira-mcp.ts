import {
  ATLASSIAN_ROVO_MCP_URL,
  JIRA_MCP_SERVER_NAME,
  jiraSettingsSchema,
  type JiraCredentials,
  type McpServerConfig,
} from "@open-inspect/shared/types/integrations";
import { IntegrationSettingsStore } from "../db/integration-settings";
import type { SqlDatabase } from "../db/sql-database";
import { createLogger } from "../logger";

const logger = createLogger("session-jira-mcp");

/** Stable synthetic id; never collides with the 16-hex ids of stored MCP servers. */
export const JIRA_MCP_SERVER_ID = "integration:jira";

export interface JiraCredentialsLookup {
  get(): Promise<JiraCredentials | null>;
}

function base64Utf8(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

export function buildJiraAuthorizationHeader(credentials: JiraCredentials): string {
  return credentials.authType === "basic"
    ? `Basic ${base64Utf8(`${credentials.email}:${credentials.apiToken}`)}`
    : `Bearer ${credentials.apiToken}`;
}

export function buildJiraMcpServer(credentials: JiraCredentials): McpServerConfig {
  return {
    id: JIRA_MCP_SERVER_ID,
    name: JIRA_MCP_SERVER_NAME,
    type: "remote",
    url: ATLASSIAN_ROVO_MCP_URL,
    headers: { Authorization: buildJiraAuthorizationHeader(credentials) },
    repoScopes: null,
    enabled: true,
  };
}

/**
 * Whether Jira applies to a session. Like MCP servers (and unlike the
 * primary-member gates in resolveSessionScopedSettings), this is the UNION
 * across members: injecting a tool server is additive. Repo-less sessions
 * get Jira only when it is enabled globally for all repositories.
 */
export async function resolveJiraEnabled(
  db: SqlDatabase,
  repositories: ReadonlyArray<{ repoOwner: string; repoName: string }>
): Promise<boolean> {
  const store = new IntegrationSettingsStore(db);
  if (repositories.length === 0) {
    const global = await store.getGlobal("jira");
    return global?.defaults?.enabled === true && (global.enabledRepos ?? null) === null;
  }
  const results = await Promise.all(
    repositories.map(async ({ repoOwner, repoName }) => {
      const repo = `${repoOwner}/${repoName}`;
      const { enabledRepos, settings } = await store.getResolvedConfig("jira", repo);
      if (jiraSettingsSchema.parse(settings).enabled !== true) return false;
      // enabledRepos: null -> all repos, [] -> none, [...] -> allowlist
      return enabledRepos === null || enabledRepos.includes(repo.toLowerCase());
    })
  );
  return results.some(Boolean);
}

/**
 * The Atlassian MCP server for a session, or null when Jira is disabled for
 * it, has no credentials, or cannot be resolved. Never throws, so a Jira
 * failure cannot drop the session's other MCP servers.
 */
export async function resolveJiraMcpServer(
  db: SqlDatabase,
  credentialsLookup: JiraCredentialsLookup,
  repositories: ReadonlyArray<{ repoOwner: string; repoName: string }>
): Promise<McpServerConfig | null> {
  try {
    if (!(await resolveJiraEnabled(db, repositories))) return null;
    const credentials = await credentialsLookup.get();
    if (!credentials) {
      logger.warn("Jira is enabled but has no usable credentials; skipping", {
        event: "jira.mcp_skipped",
        reason: "no_credentials",
      });
      return null;
    }
    return buildJiraMcpServer(credentials);
  } catch (e) {
    logger.warn("Failed to resolve Jira MCP server; skipping", {
      event: "jira.mcp_skipped",
      reason: "resolve_failed",
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/** A user-configured MCP server with the same name wins over the integration's. */
export function withJiraMcpServer(
  servers: McpServerConfig[],
  jiraServer: McpServerConfig | null
): McpServerConfig[] {
  if (!jiraServer) return servers;
  if (servers.some((server) => server.name === jiraServer.name)) {
    logger.warn("An MCP server with the Jira integration's name already exists; keeping it", {
      event: "jira.mcp_skipped",
      reason: "name_conflict",
      name: jiraServer.name,
    });
    return servers;
  }
  return [...servers, jiraServer];
}
