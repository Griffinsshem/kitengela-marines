import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * Fail on accessibility violations a visitor would actually hit.
 *
 * Serious and critical only: those block someone from using the page (no
 * label on a field, text nobody can read). Minor and moderate findings are
 * printed so they can be fixed, without failing the build over them.
 */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  const advisory = results.violations.filter(
    (violation) => !blocking.includes(violation),
  );
  for (const violation of advisory) {
    console.warn(
      `[axe ${violation.impact}] ${violation.id}: ${violation.help} (${page.url()})`,
    );
  }

  expect(
    blocking.map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      where: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    })),
  ).toEqual([]);
}
