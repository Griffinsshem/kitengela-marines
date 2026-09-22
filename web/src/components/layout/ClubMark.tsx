import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * The club's name as a wordmark, linking home.
 *
 * Text only for now: the crest file has not been supplied, and a placeholder
 * shape would be an invented logo. When the crest arrives it slots in here and
 * every header, footer and menu picks it up.
 */
export function ClubMark({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("font-display font-black uppercase leading-none tracking-wide", className)}
    >
      Kitengela Marines
    </Link>
  );
}
