import { describe, expect, it } from "vitest";

import { markdownToHtml } from "@/lib/markdown";

describe("markdownToHtml", () => {
  it("produces paragraphs", () => {
    expect(markdownToHtml("First para.\n\nSecond para.")).toBe(
      "<p>First para.</p><p>Second para.</p>",
    );
  });

  it("treats a single newline as a line break", () => {
    expect(markdownToHtml("Line one\nLine two")).toBe("<p>Line one<br />Line two</p>");
  });

  it("supports the headings the allow-list permits", () => {
    expect(markdownToHtml("## Report\n### Second half")).toBe(
      "<h2>Report</h2><h3>Second half</h3>",
    );
  });

  it("does not produce h1, which belongs to the article title", () => {
    expect(markdownToHtml("# Not a heading")).toBe("<p># Not a heading</p>");
  });

  it("supports emphasis and links", () => {
    expect(markdownToHtml("A **great** and *late* [winner](https://example.com)")).toBe(
      '<p>A <strong>great</strong> and <em>late</em> <a href="https://example.com">winner</a></p>',
    );
  });

  it("supports both kinds of list", () => {
    expect(markdownToHtml("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
    expect(markdownToHtml("1. one\n2. two")).toBe("<ol><li>one</li><li>two</li></ol>");
  });

  it("supports quotes", () => {
    expect(markdownToHtml("> We deserved it.")).toBe(
      "<blockquote><p>We deserved it.</p></blockquote>",
    );
  });

  it("escapes HTML typed or pasted by the author", () => {
    expect(markdownToHtml("<script>alert(1)</script>")).toBe(
      "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    );
  });

  it("escapes HTML inside a link label", () => {
    expect(markdownToHtml("[<b>x</b>](https://example.com)")).toContain("&lt;b&gt;");
  });

  it("keeps the words of an unsafe link but drops the link", () => {
    expect(markdownToHtml("[click](javascript:alert(1))")).toBe("<p>click</p>");
    expect(markdownToHtml("[x](data:text/html;base64,abc)")).toBe("<p>x</p>");
  });

  it("allows mailto links", () => {
    expect(markdownToHtml("[email](mailto:media@example.com)")).toContain(
      'href="mailto:media@example.com"',
    );
  });

  it("returns nothing for empty input", () => {
    expect(markdownToHtml("")).toBe("");
    expect(markdownToHtml("   \n\n  ")).toBe("");
  });
});
