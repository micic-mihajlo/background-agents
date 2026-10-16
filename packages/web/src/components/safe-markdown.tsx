"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { Children, isValidElement, type ComponentPropsWithoutRef, type ReactNode } from "react";
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ui/code-block";
import type { Root, RootContent } from "mdast";
import { isPathWithLineReference, isRepositoryFileHref } from "@/lib/diff-file-links";
import { useSessionFileLinks } from "@/lib/session-file-links";
import { getSafeExternalUrl } from "@/lib/urls";

// Strict sanitization schema to prevent XSS
// Based on GitHub's sanitization but even more restrictive
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    // Block elements
    "p",
    "blockquote",
    "pre",
    "code",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "hr",
    "br",
    // Inline elements
    "strong",
    "em",
    "del",
    "a",
    "img",
    "span",
  ],
  attributes: {
    ...defaultSchema.attributes,
    // Only allow href on links, and only http/https protocols
    a: ["href"],
    img: ["src", "alt", "title"],
    // Allow className for syntax highlighting
    code: ["className"],
    span: ["className"],
    pre: ["className"],
  },
  protocols: {
    href: ["http", "https"],
    src: ["http", "https"],
  },
  // Strip all other attributes
  strip: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
};
const DEFAULT_IMAGE_MODE = "omit";

function preserveFileLineReferences() {
  return (tree: Root) => {
    const visit = (node: Root | RootContent) => {
      if (
        (node.type === "link" || node.type === "definition") &&
        isPathWithLineReference(node.url)
      ) {
        // A root-level path with :line looks like a URL scheme to rehype-sanitize.
        node.url = `./${node.url}`;
      }
      if ("children" in node) node.children.forEach(visit);
    };
    visit(tree);
  };
}

interface SafeMarkdownProps {
  content: string;
  className?: string;
  baseUrl?: string;
  imageMode?: "omit" | "placeholder";
  /**
   * - `plain`: every sanitized link opens in a new tab.
   * - `repositoryFiles`: inside a session, links to changed repository files open in the
   *   changes panel. Only agent-authored text opts in; other markdown (e.g. pull request
   *   bodies) keeps plain links.
   * - `externalOnly`: untrusted repository documents. Only safe external URLs open; relative
   *   and in-page links are inert so the document cannot navigate the session.
   */
  linkMode?: "plain" | "repositoryFiles" | "externalOnly";
}

function MarkdownLink({ href, children, ...props }: ComponentPropsWithoutRef<"a">) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-accent hover:underline"
      {...props}
    >
      {children}
    </a>
  );
}

function RepositoryFileMarkdownLink({ href, children, ...props }: ComponentPropsWithoutRef<"a">) {
  const fileLinks = useSessionFileLinks();

  if (!fileLinks) {
    return (
      <MarkdownLink href={href} {...props}>
        {children}
      </MarkdownLink>
    );
  }

  const selection = fileLinks.resolve(href);
  if (!selection) {
    // The control plane can only show files in the session's diff, so a link to any
    // other repository file has nowhere to go; plain text beats a link that 404s.
    return (
      <span className="text-muted-foreground" title="Not in this session's changes">
        {children}
      </span>
    );
  }
  // An in-page action, not a destination: a button, so middle-click and "Open link" can't
  // navigate to the session-relative href.
  return (
    <button
      type="button"
      className="text-accent hover:underline cursor-pointer bg-transparent p-0 border-0 text-left font-[inherit]"
      title={selection.path}
      onClick={(event) => fileLinks.open(selection, event.currentTarget)}
    >
      {children}
    </button>
  );
}

/** Plain text of rendered markdown children, for copying highlighted code. */
function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return Children.toArray(node).map(nodeText).join("");
}

function ExternalOnlyMarkdownLink({ href, children, ...props }: ComponentPropsWithoutRef<"a">) {
  const externalHref = getSafeExternalUrl(href);
  if (!externalHref) {
    return (
      <span className="text-muted-foreground" title={href}>
        {children}
      </span>
    );
  }
  return (
    <MarkdownLink href={externalHref} {...props}>
      {children}
    </MarkdownLink>
  );
}

export function SafeMarkdown({
  content,
  className = "",
  baseUrl,
  imageMode = DEFAULT_IMAGE_MODE,
  linkMode = "plain",
}: SafeMarkdownProps) {
  return (
    <div
      className={`prose prose-sm dark:prose-invert min-w-0 max-w-none wrap-break-word wrap-anywhere ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={
          linkMode === "repositoryFiles" ? [remarkGfm, preserveFileLineReferences] : [remarkGfm]
        }
        rehypePlugins={[rehypeHighlight, [rehypeSanitize, sanitizeSchema]]}
        components={{
          a: ({ href, children, ...props }: ComponentPropsWithoutRef<"a">) => {
            if (linkMode === "externalOnly") {
              return (
                <ExternalOnlyMarkdownLink href={href} {...props}>
                  {children}
                </ExternalOnlyMarkdownLink>
              );
            }
            const resolvedHref = resolveMarkdownUrl(href, baseUrl);
            if (!resolvedHref) return <span>{children}</span>;
            if (linkMode === "repositoryFiles" && isRepositoryFileHref(href)) {
              return (
                <RepositoryFileMarkdownLink href={href} {...props}>
                  {children}
                </RepositoryFileMarkdownLink>
              );
            }
            return (
              <MarkdownLink href={resolvedHref} {...props}>
                {children}
              </MarkdownLink>
            );
          },
          img: ({ src, alt }: ComponentPropsWithoutRef<"img">) => {
            const resolvedSrc = resolveMarkdownUrl(
              typeof src === "string" ? src : undefined,
              baseUrl
            );
            if (imageMode !== "placeholder") return null;
            return <span>{resolvedSrc ? `${alt?.trim() || "Image"}: ${resolvedSrc}` : alt}</span>;
          },
          // Fenced code renders as a Code Block. rehype-highlight still tokenizes it, so the
          // user's highlight theme colors the tokens.
          pre: ({ children }: ComponentPropsWithoutRef<"pre">) => {
            const code = isValidElement<{ className?: string; children?: ReactNode }>(children)
              ? children.props
              : { className: undefined, children };
            const language = /language-([\w+-]+)/.exec(code.className ?? "")?.[1];
            const text = nodeText(code.children).replace(/\n$/, "");
            return (
              <CodeBlock className="not-prose my-3">
                <CodeBlockHeader>
                  <CodeBlockTitle className="font-mono text-xs font-normal text-muted-foreground">
                    {language ?? "text"}
                  </CodeBlockTitle>
                  <CodeBlockActions>
                    <CodeBlockCopyButton value={text} />
                  </CodeBlockActions>
                </CodeBlockHeader>
                <CodeBlockContent className="text-[13px]">
                  <span>{code.children}</span>
                </CodeBlockContent>
              </CodeBlock>
            );
          },
          code: ({ className, children, ...props }: ComponentPropsWithoutRef<"code">) => {
            // Code blocks: pass through hljs/language classes for syntax highlighting
            if (className) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            // Inline code: explicit styling with background, border, and monospace
            return (
              <code
                className="rounded-[4px] bg-muted px-1 py-0.5 font-mono text-[0.85em] font-medium text-foreground/80"
                {...props}
              >
                {children}
              </code>
            );
          },
          // Paragraphs
          p: ({ children, ...props }: ComponentPropsWithoutRef<"p">) => (
            <p className="mb-2 last:mb-0" {...props}>
              {children}
            </p>
          ),
          // Lists
          ul: ({ children, ...props }: ComponentPropsWithoutRef<"ul">) => (
            <ul className="list-disc pl-4 mb-2" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }: ComponentPropsWithoutRef<"ol">) => (
            <ol className="list-decimal pl-4 mb-2" {...props}>
              {children}
            </ol>
          ),
          // Blockquotes
          blockquote: ({ children, ...props }: ComponentPropsWithoutRef<"blockquote">) => (
            <blockquote className="border-l-2 border-border pl-4 text-muted-foreground" {...props}>
              {children}
            </blockquote>
          ),
          // Tables
          table: ({ children, ...props }: ComponentPropsWithoutRef<"table">) => (
            <div className="not-prose my-3 max-w-full overflow-x-auto rounded-lg border border-border-muted">
              <table
                className="min-w-full border-collapse text-[13px] [&_tr:last-child_td]:border-b-0"
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }: ComponentPropsWithoutRef<"th">) => (
            <th
              className="border-b border-border-muted bg-panel px-3 py-1.5 text-left text-xs font-medium text-muted-foreground"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }: ComponentPropsWithoutRef<"td">) => (
            <td className="border-b border-border-muted px-3 py-1.5" {...props}>
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function resolveMarkdownUrl(value: string | undefined, baseUrl: string | undefined): string | null {
  if (!value) return null;
  if (!baseUrl) return value;
  try {
    const resolved = new URL(value, baseUrl);
    return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.href : null;
  } catch {
    return null;
  }
}
