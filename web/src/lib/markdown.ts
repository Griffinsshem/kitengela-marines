/**
 * Markdown to HTML, restricted to what the API will accept.
 *
 * The API sanitises against a small allow-list: paragraphs, bold, italics,
 * links, lists, h2/h3 and blockquote. A general markdown library would emit
 * images, tables and raw HTML that the sanitiser then silently strips, so a
 * writer would see formatting in the preview that never reached the page.
 * This converter can only produce what survives, so the preview is honest.
 *
 * Every character of input is escaped before any markup is added, so nothing
 * an author types — deliberately or pasted from elsewhere — can inject HTML.
 */

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

/** Only these schemes. A javascript: or data: link would be stripped anyway. */
function safeHref(url: string): string | null {
  const trimmed = url.trim();
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? escapeHtml(trimmed) : null;
}

function inline(text: string): string {
  let output = escapeHtml(text);

  // Links first: their text may itself contain emphasis.
  // One level of nested brackets, because URLs legitimately contain them,
  // e.g. a Wikipedia link ending in _(disambiguation).
  const LINK = /\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;
  output = output.replace(LINK, (_match, label: string, url: string) => {
    const href = safeHref(url);
    // An unsafe link keeps its words and loses its link, rather than vanishing.
    return href ? `<a href="${href}">${label}</a>` : label;
  });

  output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  output = output.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");

  return output;
}

type Block =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "quote"; lines: string[] }
  | { kind: "list"; ordered: boolean; items: string[] };

function blocks(markdown: string): Block[] {
  const result: Block[] = [];
  let current: Block | null = null;

  const flush = () => {
    if (current) result.push(current);
    current = null;
  };

  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();

    if (line.trim() === "") {
      flush();
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading?.[1] && heading[2] !== undefined) {
      flush();
      result.push({ kind: "heading", level: heading[1].length === 2 ? 2 : 3, text: heading[2] });
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      if (current?.kind !== "quote") {
        flush();
        current = { kind: "quote", lines: [] };
      }
      current.lines.push(quote[1] ?? "");
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet?.[1] !== undefined) {
      if (current?.kind !== "list" || current.ordered) {
        flush();
        current = { kind: "list", ordered: false, items: [] };
      }
      current.items.push(bullet[1]);
      continue;
    }

    const numbered = /^\d+\.\s+(.*)$/.exec(line);
    if (numbered?.[1] !== undefined) {
      if (current?.kind !== "list" || !current.ordered) {
        flush();
        current = { kind: "list", ordered: true, items: [] };
      }
      current.items.push(numbered[1]);
      continue;
    }

    if (current?.kind !== "paragraph") {
      flush();
      current = { kind: "paragraph", lines: [] };
    }
    current.lines.push(line);
  }

  flush();
  return result;
}

export function markdownToHtml(markdown: string): string {
  return blocks(markdown)
    .map((block) => {
      switch (block.kind) {
        case "heading":
          return `<h${block.level}>${inline(block.text)}</h${block.level}>`;
        case "quote":
          return `<blockquote><p>${inline(block.lines.join(" "))}</p></blockquote>`;
        case "list": {
          const tag = block.ordered ? "ol" : "ul";
          const items = block.items.map((item) => `<li>${inline(item)}</li>`).join("");
          return `<${tag}>${items}</${tag}>`;
        }
        case "paragraph":
          // A single newline inside a paragraph is a line break, as a writer
          // pressing Enter once expects.
          return `<p>${inline(block.lines.join("\n")).replace(/\n/g, "<br />")}</p>`;
      }
    })
    .join("");
}
