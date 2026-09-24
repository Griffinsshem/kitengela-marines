import type { ReactNode } from "react";

import { MatchCard } from "@/components/match/MatchCard";
import type { ApiResult } from "@/lib/api";
import type { Fixture } from "@/lib/schemas";

/**
 * The next match, shown inside the hero.
 *
 * Three states, and the difference between the last two matters: no fixture
 * announced is a fact about the county league's schedule, while a failed
 * request is a fact about our own server. Telling supporters no fixtures exist
 * when the API is down would be false.
 */
export function NextMatch({ result }: { result: ApiResult<Fixture | null> }) {
  if (!result.ok) {
    return (
      <Panel title="Next match">
        <p className="text-chalk/75">Fixture information could not be loaded just now.</p>
      </Panel>
    );
  }

  if (result.data === null) {
    return (
      <Panel title="Next match">
        <p className="text-chalk/75">
          Kajiado County League fixtures will appear here as soon as they are officially
          announced.
        </p>
      </Panel>
    );
  }

  return (
    <div>
      <p className="mb-3 text-meta font-semibold uppercase tracking-widest text-accent-glow">
        Next match
      </p>
      <MatchCard fixture={result.data} tone="dark" />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border border-chalk/20 bg-chalk/5 p-6">
      <p className="text-meta font-semibold uppercase tracking-widest text-accent-glow">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
