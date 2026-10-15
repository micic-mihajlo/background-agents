"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import type {
  JiraAuthType,
  JiraCredentials,
  JiraCredentialsStatus,
} from "@open-inspect/shared/types/integrations";
import { EnablementIntegrationSettings } from "./enablement-integration-settings";
import { SettingsCardSection } from "../settings-card-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioCard } from "@/components/ui/form-controls";
import { browserApiFetch } from "@/lib/browser-api-fetch";
import { useCurrentUserAuthorization } from "@/hooks/use-current-user-authorization";

const CREDENTIALS_KEY = "/api/integration-settings/jira/credentials";

interface CredentialsResponse {
  credentials: JiraCredentialsStatus;
}

export function JiraIntegrationSettings() {
  return (
    <EnablementIntegrationSettings
      copy={{
        id: "jira",
        title: "Jira",
        intro:
          "Give agents access to Jira Cloud through Atlassian's Rovo MCP server. When enabled, sessions can search issues with JQL, read and edit issues, comment, and move issues between statuses.",
        overrideDescription: "Override Jira access for specific repositories.",
        enableLabel: "Enable Jira",
        enableDescription: "Add the Atlassian MCP server to new sandbox sessions",
        scopeDescription: "Enable Jira globally or for specific repositories.",
        allRepositoriesDescription:
          "Jira is available for sessions on every accessible repository, and for sessions without a repository.",
        selectedRepositoriesDescription:
          "Jira is only available for repositories in the allowlist.",
        emptySelectionWarning: "No repositories selected. Jira will not be enabled.",
        emptyOverrides:
          "No repository overrides yet. Add one to enable or disable Jira per repository.",
        resetDescription:
          "Reset global Jira defaults and repository scope? Credentials and per-repository overrides will not be affected.",
      }}
    >
      <JiraCredentialsSection />
    </EnablementIntegrationSettings>
  );
}

function describeStatus(status: JiraCredentialsStatus | undefined): string {
  if (!status?.configured) return "Not connected.";
  const method =
    status.authType === "basic"
      ? `a personal API token for ${status.email}`
      : "a service account API key";
  const updated = status.updatedAt
    ? ` Updated ${new Date(status.updatedAt).toLocaleString()}.`
    : "";
  return `Connected with ${method}.${updated}`;
}

function JiraCredentialsSection() {
  const { hasPermission } = useCurrentUserAuthorization();
  const canManage = hasPermission("integrations.manage");
  const { data } = useSWR<CredentialsResponse>(CREDENTIALS_KEY);
  const status = data?.credentials;

  const [authType, setAuthType] = useState<JiraAuthType>("basic");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = apiToken.trim() !== "" && (authType === "bearer" || email.trim() !== "");

  const handleSave = async () => {
    setSaving(true);
    const credentials: JiraCredentials =
      authType === "basic"
        ? { authType, email: email.trim(), apiToken: apiToken.trim() }
        : { authType, apiToken: apiToken.trim() };

    try {
      const res = await browserApiFetch(CREDENTIALS_KEY, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials }),
      });
      if (res.ok) {
        mutate(CREDENTIALS_KEY);
        setApiToken("");
        toast.success("Jira credentials saved.");
      } else {
        const body = await res.json();
        toast.error(body.error || "Failed to save Jira credentials");
      }
    } catch {
      toast.error("Failed to save Jira credentials");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      const res = await browserApiFetch(CREDENTIALS_KEY, { method: "DELETE" });
      if (res.ok) {
        mutate(CREDENTIALS_KEY);
        toast.success("Jira credentials removed.");
      } else {
        const body = await res.json();
        toast.error(body.error || "Failed to remove Jira credentials");
      }
    } catch {
      toast.error("Failed to remove Jira credentials");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCardSection
      title="Atlassian Credentials"
      description="An organization admin must allow API-token authentication for the Rovo MCP server (Atlassian Administration › Rovo › Rovo MCP server › Authentication). Agents act with the token owner's Jira permissions."
    >
      <p className="mb-4 text-sm text-foreground">{describeStatus(status)}</p>

      <fieldset disabled={!canManage || saving} className="min-w-0 space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <RadioCard
            name="jira-auth-type"
            checked={authType === "basic"}
            onChange={() => setAuthType("basic")}
            label="Personal API token"
            description="A scoped token from id.atlassian.com, paired with your Atlassian email."
          />
          <RadioCard
            name="jira-auth-type"
            checked={authType === "bearer"}
            onChange={() => setAuthType("bearer")}
            label="Service account API key"
            description="Agent changes appear under a bot account instead of a person."
          />
        </div>

        {authType === "basic" && (
          <div className="space-y-1.5">
            <Label htmlFor="jira-email">Atlassian email</Label>
            <Input
              id="jira-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="jira-api-token">
            {authType === "basic" ? "API token (with scopes)" : "API key"}
          </Label>
          <Input
            id="jira-api-token"
            type="password"
            autoComplete="off"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder={status?.configured ? "Enter a new value to replace the saved one" : ""}
          />
          {authType === "basic" && (
            <p className="text-xs text-muted-foreground">
              Use &ldquo;Create API token with scopes&rdquo;. Classic tokens connect but expose no
              Jira tools.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={!canSave}>
            {saving ? "Saving..." : status?.configured ? "Replace credentials" : "Save credentials"}
          </Button>
          {status?.configured && (
            <Button variant="destructive" onClick={handleRemove}>
              Remove
            </Button>
          )}
        </div>
      </fieldset>
    </SettingsCardSection>
  );
}
