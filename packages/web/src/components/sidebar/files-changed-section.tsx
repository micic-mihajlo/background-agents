"use client";

import { useMemo, useState } from "react";
import type {
  SessionDiffFile,
  SessionDiffRepository,
} from "@open-inspect/shared/types/session-diffs";
import { buildUniquePathLabels, type DiffSelection } from "@/lib/session-diffs";
import { cn } from "@/lib/utils";
import { ChevronRightIcon, FileIcon, FolderIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface FilesChangedSectionProps {
  repositories: SessionDiffRepository[];
  selected?: DiffSelection | null;
  onSelect: (repository: SessionDiffRepository, file: SessionDiffFile) => void;
}

const STATUS_LABELS: Record<SessionDiffFile["status"], string> = {
  added: "A",
  modified: "M",
  deleted: "D",
  renamed: "R",
  type_changed: "T",
  unmerged: "U",
  submodule: "S",
};

const STATUS_NAMES: Record<SessionDiffFile["status"], string> = {
  added: "added",
  modified: "modified",
  deleted: "deleted",
  renamed: "renamed",
  type_changed: "type changed",
  unmerged: "unmerged",
  submodule: "submodule",
};

function fileSummary(file: SessionDiffFile): string {
  if (file.renderState === "binary") return "binary";
  if (file.renderState === "too_large") return "too large";
  if (file.renderState === "metadata_only") return "metadata";
  return `+${file.additions ?? 0} -${file.deletions ?? 0}`;
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

type FileTreeNode =
  | { type: "file"; path: string; file: SessionDiffFile }
  | { type: "folder"; name: string; path: string; children: FileTreeNode[] };

/** Groups files into folders, compressing single-folder chains like `packages/web`. */
function buildFileTree(files: SessionDiffFile[]): FileTreeNode[] {
  type Folder = { folders: Map<string, Folder>; files: SessionDiffFile[] };
  const root: Folder = { folders: new Map(), files: [] };
  for (const file of files) {
    const segments = file.path.split("/").slice(0, -1);
    let folder = root;
    for (const segment of segments) {
      let next = folder.folders.get(segment);
      if (!next) {
        next = { folders: new Map(), files: [] };
        folder.folders.set(segment, next);
      }
      folder = next;
    }
    folder.files.push(file);
  }

  const toNodes = (folder: Folder, prefix: string): FileTreeNode[] => [
    ...[...folder.folders.entries()].map(([name, child]): FileTreeNode => {
      let label = name;
      let current = child;
      while (current.files.length === 0 && current.folders.size === 1) {
        const [nextName, next] = [...current.folders.entries()][0];
        label = `${label}/${nextName}`;
        current = next;
      }
      const path = prefix ? `${prefix}/${label}` : label;
      return { type: "folder", name: label, path, children: toNodes(current, path) };
    }),
    ...folder.files.map((file): FileTreeNode => ({ type: "file", path: file.path, file })),
  ];
  return toNodes(root, "");
}

/** The changed files as folders you can open, following the AI Elements File Tree pattern. */
function ChangedFileTree({
  files,
  forceOpen,
  renderFile,
}: {
  files: SessionDiffFile[];
  forceOpen: boolean;
  renderFile: (file: SessionDiffFile, depth: number) => React.ReactNode;
}) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  const renderNode = (node: FileTreeNode, depth: number): React.ReactNode =>
    node.type === "file" ? (
      renderFile(node.file, depth)
    ) : (
      <FolderNode key={node.path} name={node.name} depth={depth} forceOpen={forceOpen}>
        {node.children.map((child) => renderNode(child, depth + 1))}
      </FolderNode>
    );
  return <div className="flex flex-col gap-px">{tree.map((node) => renderNode(node, 0))}</div>;
}

function FolderNode({
  name,
  depth,
  forceOpen,
  children,
}: {
  name: string;
  depth: number;
  forceOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible
      open={forceOpen || open}
      onOpenChange={(next) => {
        if (!forceOpen) setOpen(next);
      }}
      className="group/folder flex flex-col gap-px"
    >
      <CollapsibleTrigger
        className="flex h-7 w-full min-w-0 items-center gap-1.5 rounded-md pr-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        style={{ paddingLeft: `${0.25 + depth * 0.75}rem` }}
      >
        <ChevronRightIcon
          className="size-3.5 shrink-0 transition-transform duration-200 ease-in-out-strong group-data-[state=open]/folder:rotate-90"
          aria-hidden="true"
        />
        <FolderIcon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 truncate">{name}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-px">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function RepositoryGroup({
  label,
  forceOpen,
  children,
}: {
  label: string;
  forceOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <details
      open={forceOpen || open}
      onToggle={(event) => {
        if (!forceOpen) setOpen(event.currentTarget.open);
      }}
    >
      <summary
        title={label}
        className="mb-1.5 cursor-pointer text-[11px] font-medium text-muted-foreground wrap-anywhere"
      >
        {label}
      </summary>
      <div className="pl-1">{children}</div>
    </details>
  );
}

export function FilesChangedSection({
  repositories,
  selected,
  onSelect,
}: FilesChangedSectionProps) {
  const [query, setQuery] = useState("");
  const paths = useMemo(
    () => repositories.flatMap((repository) => repository.files.map((file) => file.path)),
    [repositories]
  );
  const labels = useMemo(() => buildUniquePathLabels(paths), [paths]);
  const normalizedQuery = query.trim().toLowerCase();
  const fileCount = paths.length;
  if (fileCount === 0 && repositories.every((repository) => repository.status === "ready")) {
    return null;
  }

  return (
    <div className="space-y-3">
      {fileCount > 0 && (
        <input
          type="search"
          aria-label="Filter changed files"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Filter ${fileCount} changed file${fileCount === 1 ? "" : "s"}`}
          className="h-8 w-full rounded-md border border-border-muted bg-background px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}
      {normalizedQuery && !paths.some((path) => path.toLowerCase().includes(normalizedQuery)) && (
        <p role="status" className="px-1 text-xs leading-relaxed text-muted-foreground">
          No changed files match “{query}”.
        </p>
      )}
      <div className="space-y-3">
        {repositories.map((repository) => {
          const key = `${repository.position}:${repository.repoOwner}/${repository.repoName}`;
          if (repository.status === "unavailable") {
            const contents = <p className="text-[11px] text-warning">{repository.error}</p>;
            return repositories.length > 1 ? (
              <RepositoryGroup
                key={key}
                label={`${repository.repoOwner}/${repository.repoName}`}
                forceOpen
              >
                {contents}
              </RepositoryGroup>
            ) : (
              <div key={key}>{contents}</div>
            );
          }
          const files = repository.files.filter((file) =>
            normalizedQuery ? file.path.toLowerCase().includes(normalizedQuery) : true
          );
          if (files.length === 0) return null;
          const contents = (
            <>
              <ChangedFileTree
                files={files}
                forceOpen={Boolean(normalizedQuery)}
                renderFile={(file, depth) => {
                  const summary = fileSummary(file);
                  const active =
                    selected?.repositoryPosition === repository.position &&
                    selected.path === file.path;
                  return (
                    <button
                      type="button"
                      key={file.id}
                      style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
                      title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                      aria-label={`${labels[file.path]} ${STATUS_NAMES[file.status]} ${summary}`}
                      aria-current={active ? "true" : undefined}
                      data-diff-repository-position={repository.position}
                      data-diff-path={file.path}
                      onClick={() => onSelect(repository, file)}
                      className={cn(
                        "flex h-7 w-full items-center gap-1.5 rounded-md pr-2 text-left text-xs transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                        active
                          ? "bg-accent-muted text-foreground"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <span
                        className="w-3 shrink-0 font-mono text-[10px] font-semibold text-muted-foreground"
                        aria-hidden="true"
                      >
                        {STATUS_LABELS[file.status]}
                      </span>
                      <FileIcon
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">{fileName(file.path)}</span>
                      {file.renderState === "renderable" ? (
                        <span className="flex shrink-0 gap-1 font-mono text-[10px]">
                          <span className="text-success">+{file.additions ?? 0}</span>
                          <span className="text-destructive">-{file.deletions ?? 0}</span>
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {summary}
                        </span>
                      )}
                    </button>
                  );
                }}
              />
              {repository.truncated && (
                <p className="mt-2 text-[11px] text-warning">
                  {repository.omittedFileCount} additional files omitted
                </p>
              )}
            </>
          );
          return repositories.length > 1 ? (
            <RepositoryGroup
              key={key}
              label={`${repository.repoOwner}/${repository.repoName}`}
              forceOpen={Boolean(normalizedQuery)}
            >
              {contents}
            </RepositoryGroup>
          ) : (
            <div key={key}>{contents}</div>
          );
        })}
      </div>
    </div>
  );
}
