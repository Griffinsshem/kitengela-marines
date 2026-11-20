import { describe, expect, it } from "vitest";

import { isLeavingWithinSite } from "./unsaved";

const here = {
  origin: "https://site.test",
  pathname: "/admin/news/1",
  search: "",
};
const plain = {
  button: 0,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
};

describe("isLeavingWithinSite", () => {
  it("questions a plain click to another admin page", () => {
    expect(isLeavingWithinSite({ href: "/admin/fixtures" }, plain, here)).toBe(
      true,
    );
    expect(
      isLeavingWithinSite({ href: "https://site.test/admin" }, plain, here),
    ).toBe(true);
  });

  it("questions a change of query on the same page", () => {
    expect(
      isLeavingWithinSite({ href: "/admin/news/1?tab=x" }, plain, here),
    ).toBe(true);
  });

  it("leaves in-page anchors alone", () => {
    expect(
      isLeavingWithinSite({ href: "/admin/news/1#body" }, plain, here),
    ).toBe(false);
  });

  it("leaves new tabs, downloads and other sites to the browser", () => {
    expect(
      isLeavingWithinSite({ href: "/admin", target: "_blank" }, plain, here),
    ).toBe(false);
    expect(
      isLeavingWithinSite({ href: "/file.csv", download: true }, plain, here),
    ).toBe(false);
    expect(
      isLeavingWithinSite(
        { href: "/admin" },
        { ...plain, metaKey: true },
        here,
      ),
    ).toBe(false);
    expect(
      isLeavingWithinSite({ href: "/admin" }, { ...plain, button: 1 }, here),
    ).toBe(false);
    expect(
      isLeavingWithinSite({ href: "https://example.com/" }, plain, here),
    ).toBe(false);
  });
});
