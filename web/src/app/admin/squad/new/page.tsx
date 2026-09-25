"use client";

import { PlayerForm } from "@/components/admin/PlayerForm";

export default function NewPlayerPage() {
  return (
    <div>
      <h1 className="font-display text-headline font-extrabold uppercase">Add a player</h1>
      <p className="mt-2 text-muted">
        The player appears on the team&rsquo;s page as soon as they are saved.
      </p>
      <div className="mt-8">
        <PlayerForm />
      </div>
    </div>
  );
}
