"use client";

import { FixtureForm } from "@/components/admin/FixtureForm";

export default function NewFixturePage() {
  return (
    <div>
      <h1 className="font-display text-headline font-extrabold uppercase">Add a fixture</h1>
      <p className="mt-2 text-muted">The match appears on the website as soon as it is saved.</p>
      <div className="mt-8">
        <FixtureForm />
      </div>
    </div>
  );
}
