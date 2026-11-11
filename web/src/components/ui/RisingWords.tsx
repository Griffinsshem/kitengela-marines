import type { CSSProperties } from "react";

/**
 * A headline whose words rise into place from behind a mask, one after
 * another, like a broadcast title card.
 *
 * The text stays ordinary text: each word is an inline span, separated by real
 * spaces, so it wraps, selects, copies and reads aloud exactly as the plain
 * string would. The movement is entirely in CSS (`.entrance-words` in
 * globals.css) and only happens when the visitor has not asked for less
 * motion. Words are split from whatever the club has entered, so nothing about
 * the club's name is assumed here.
 */
export function RisingWords({ text }: { text: string }) {
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <span className="entrance-words">
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span className="word-mask">
            <span style={{ "--i": index } as CSSProperties}>{word}</span>
          </span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}
