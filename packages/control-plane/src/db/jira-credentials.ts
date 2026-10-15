import {
  jiraCredentialsSchema,
  type JiraCredentials,
  type JiraCredentialsStatus,
} from "@open-inspect/shared/types/integrations";
import { decryptToken, encryptToken } from "../auth/crypto";
import { createLogger } from "../logger";
import type { SqlDatabase } from "./sql-database";

const log = createLogger("db:jira-credentials");

const JIRA_INTEGRATION_ID = "jira";

interface IntegrationCredentialsRow {
  credentials: string;
  updated_at: number;
}

export class JiraCredentialsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JiraCredentialsValidationError";
  }
}

/** Parses untrusted input into credentials, throwing a user-facing validation error. */
export function parseJiraCredentials(value: unknown): JiraCredentials {
  const result = jiraCredentialsSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join(".");
    throw new JiraCredentialsValidationError(
      field ? `Invalid Jira credentials: ${field} ${issue.message}` : "Invalid Jira credentials"
    );
  }
  return result.data;
}

/** Stores the single Jira credential set, encrypted at rest. */
export class JiraCredentialStore {
  constructor(
    private readonly db: SqlDatabase,
    private readonly encryptionKey: string
  ) {}

  private async getRow(): Promise<IntegrationCredentialsRow | null> {
    return this.db
      .prepare(
        "SELECT credentials, updated_at FROM integration_credentials WHERE integration_id = ?"
      )
      .bind(JIRA_INTEGRATION_ID)
      .first<IntegrationCredentialsRow>();
  }

  private async decryptRow(row: IntegrationCredentialsRow): Promise<JiraCredentials | null> {
    try {
      const plain = await decryptToken(row.credentials, this.encryptionKey);
      return jiraCredentialsSchema.parse(JSON.parse(plain));
    } catch (e) {
      log.error("Jira credentials could not be decrypted", {
        event: "jira_credentials.decrypt_error",
        error: e instanceof Error ? e.message : String(e),
      });
      return null;
    }
  }

  async get(): Promise<JiraCredentials | null> {
    const row = await this.getRow();
    return row ? this.decryptRow(row) : null;
  }

  async getStatus(): Promise<JiraCredentialsStatus> {
    const row = await this.getRow();
    const credentials = row ? await this.decryptRow(row) : null;
    if (!row || !credentials) {
      return { configured: false, authType: null, email: null, updatedAt: null };
    }
    return {
      configured: true,
      authType: credentials.authType,
      email: credentials.authType === "basic" ? credentials.email : null,
      updatedAt: row.updated_at,
    };
  }

  async set(credentials: JiraCredentials): Promise<void> {
    const encrypted = await encryptToken(JSON.stringify(credentials), this.encryptionKey);
    const now = Date.now();
    await this.db
      .prepare(
        `INSERT INTO integration_credentials (integration_id, credentials, created_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(integration_id) DO UPDATE SET
           credentials = excluded.credentials,
           updated_at = excluded.updated_at`
      )
      .bind(JIRA_INTEGRATION_ID, encrypted, now, now)
      .run();
  }

  async delete(): Promise<void> {
    await this.db
      .prepare("DELETE FROM integration_credentials WHERE integration_id = ?")
      .bind(JIRA_INTEGRATION_ID)
      .run();
  }
}
