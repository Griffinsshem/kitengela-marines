import { ImageResponse } from "next/og";

/**
 * The browser tab mark.
 *
 * A wordmark, not a crest: the club has not supplied one, and inventing a
 * badge for a real club would be worse than going without. When the crest
 * arrives this file is replaced by the image itself.
 *
 * Generated rather than drawn so it stays in step with the club's colours.
 */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#011e0f",
          color: "#ffffff",
          fontSize: 34,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          // The kit stripe, kept legible at 16 pixels.
          borderBottom: "6px solid #03994b",
        }}
      >
        KM
      </div>
    ),
    size,
  );
}
