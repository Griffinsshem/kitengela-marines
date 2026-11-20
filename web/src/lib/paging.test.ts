import { describe, expect, it } from "vitest";

import { hasMorePages, mergePage, readPage, withPage } from "./paging";

describe("mergePage", () => {
  it("appends new rows in order", () => {
    expect(
      mergePage([{ id: "a" }], [{ id: "b" }, { id: "c" }]).map((r) => r.id),
    ).toEqual(["a", "b", "c"]);
  });

  it("drops a row that shifted onto the next page after a deletion", () => {
    const merged = mergePage(
      [{ id: "a" }, { id: "b" }],
      [{ id: "b" }, { id: "c" }],
    );
    expect(merged.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps the same array when nothing is new, so React skips a render", () => {
    const existing = [{ id: "a" }];
    expect(mergePage(existing, [{ id: "a" }])).toBe(existing);
  });
});

describe("hasMorePages", () => {
  it("is true until the last page has been loaded", () => {
    expect(hasMorePages({ page: 1, pages: 3, total: 120 })).toBe(true);
    expect(hasMorePages({ page: 3, pages: 3, total: 120 })).toBe(false);
    expect(hasMorePages({ page: 1, pages: 0, total: 0 })).toBe(false);
    expect(hasMorePages(null)).toBe(false);
  });
});

describe("readPage", () => {
  it("reads rows and meta from the API envelope", () => {
    expect(
      readPage({ data: [{ id: "a" }], meta: { page: 1, pages: 2, total: 51 } }),
    ).toEqual({
      rows: [{ id: "a" }],
      meta: { page: 1, pages: 2, total: 51 },
    });
  });

  it("survives a malformed body", () => {
    expect(readPage(null)).toEqual({ rows: [], meta: null });
    expect(readPage({ data: "nope", meta: { page: "1" } })).toEqual({
      rows: [],
      meta: null,
    });
  });
});

describe("withPage", () => {
  it("keeps existing filters and sets the page", () => {
    expect(withPage("/admin/articles?status=draft", 2, 50)).toBe(
      "/admin/articles?status=draft&page=2&per_page=50",
    );
    expect(withPage("/admin/videos", 1, 50)).toBe(
      "/admin/videos?page=1&per_page=50",
    );
  });
});
