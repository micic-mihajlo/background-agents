// @vitest-environment jsdom
/// <reference types="@testing-library/jest-dom" />

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as matchers from "@testing-library/jest-dom/matchers";
import type { JiraCredentialsStatus } from "@open-inspect/shared/types/integrations";
import { JiraIntegrationSettings } from "./jira-integration-settings";

const allowedPermissions = vi.hoisted(() => ({ value: null as Set<string> | null }));

vi.mock("@/hooks/use-current-user-authorization", () => ({
  useCurrentUserAuthorization: () => ({
    hasPermission: (permission: string) =>
      allowedPermissions.value === null || allowedPermissions.value.has(permission),
  }),
}));

expect.extend(matchers);

const { useSWRMock, mutateMock } = vi.hoisted(() => ({
  useSWRMock: vi.fn(),
  mutateMock: vi.fn(),
}));

vi.mock("swr", () => ({
  default: useSWRMock,
  mutate: mutateMock,
}));

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

const fetchMock = vi.fn();
const CREDENTIALS_KEY = "/api/integration-settings/jira/credentials";

const NOT_CONFIGURED: JiraCredentialsStatus = {
  configured: false,
  authType: null,
  email: null,
  updatedAt: null,
};

function setupSWR(credentials: JiraCredentialsStatus) {
  useSWRMock.mockImplementation((key: string) => {
    if (key === "/api/integration-settings/jira") {
      return { data: { settings: null }, isLoading: false };
    }
    if (key === "/api/integration-settings/jira/repos") {
      return { data: { repos: [] }, isLoading: false };
    }
    if (key === CREDENTIALS_KEY) {
      return { data: { credentials }, isLoading: false };
    }
    return { data: undefined, isLoading: false };
  });
}

function okJson(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  mutateMock.mockReset();
  useSWRMock.mockReset();
  allowedPermissions.value = null;
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Jira integration settings", () => {
  it("saves a personal API token with its email and clears the token field", async () => {
    const user = userEvent.setup();
    setupSWR(NOT_CONFIGURED);
    fetchMock.mockResolvedValue(okJson({}));

    render(<JiraIntegrationSettings />);

    expect(screen.getByText("Not connected.")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save credentials" });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText("Atlassian email"), "dev@stan.example");
    const token = screen.getByLabelText("API token (with scopes)");
    await user.type(token, "secret-token");
    await user.click(save);

    expect(fetchMock).toHaveBeenCalledWith(
      CREDENTIALS_KEY,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          credentials: { authType: "basic", email: "dev@stan.example", apiToken: "secret-token" },
        }),
      })
    );
    expect(mutateMock).toHaveBeenCalledWith(CREDENTIALS_KEY);
    expect(token).toHaveValue("");
  });

  it("saves a service account key without an email", async () => {
    const user = userEvent.setup();
    setupSWR(NOT_CONFIGURED);
    fetchMock.mockResolvedValue(okJson({}));

    render(<JiraIntegrationSettings />);

    await user.click(screen.getByRole("radio", { name: /service account api key/i }));
    expect(screen.queryByLabelText("Atlassian email")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("API key"), "sa-key");
    await user.click(screen.getByRole("button", { name: "Save credentials" }));

    expect(fetchMock).toHaveBeenCalledWith(
      CREDENTIALS_KEY,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ credentials: { authType: "bearer", apiToken: "sa-key" } }),
      })
    );
  });

  it("shows the saved connection and removes it", async () => {
    const user = userEvent.setup();
    setupSWR({ configured: true, authType: "basic", email: "dev@stan.example", updatedAt: null });
    fetchMock.mockResolvedValue(okJson({}));

    render(<JiraIntegrationSettings />);

    expect(
      screen.getByText("Connected with a personal API token for dev@stan.example.")
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));

    expect(fetchMock).toHaveBeenCalledWith(
      CREDENTIALS_KEY,
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("disables credential editing without integrations.manage", () => {
    allowedPermissions.value = new Set(["integrations.read"]);
    setupSWR(NOT_CONFIGURED);

    render(<JiraIntegrationSettings />);

    expect(screen.getByLabelText("API token (with scopes)")).toBeDisabled();
    expect(screen.getByLabelText("Atlassian email")).toBeDisabled();
  });
});
