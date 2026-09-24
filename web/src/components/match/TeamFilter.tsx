import { FilterLinks } from "@/components/ui/FilterLinks";
import type { Team } from "@/lib/schemas";

export function TeamFilter({
  teams,
  basePath,
  current,
}: {
  teams: Team[];
  basePath: string;
  current?: string;
}) {
  return (
    <FilterLinks
      label="Filter by team"
      paramName="team"
      basePath={basePath}
      current={current}
      options={[
        { label: "All teams" },
        ...teams.map((team) => ({ value: team.slug, label: team.short_name })),
      ]}
    />
  );
}
