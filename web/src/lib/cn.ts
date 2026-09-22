import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must be told about the custom type scale. Without this it
 * reads `text-score` as a colour and silently drops it when `text-chalk`
 * appears in the same class list, and headlines lose their size.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["meta", "headline", "display", "score"],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
