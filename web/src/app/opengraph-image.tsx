import { ImageResponse } from "next/og";

/**
 * The picture that appears when the site is shared.
 *
 * Most of this club's links will travel through WhatsApp, where a link with no
 * image is a grey box and a link with one is an advert for the club. Pages
 * with their own photograph — an article, a gallery — override this; every
 * other page falls back to it.
 */
export const alt = "Kitengela Marines — football club from Kitengela, Kajiado County";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#011e0f",
          color: "#ffffff",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", width: 240, height: 12 }}>
          <div style={{ flex: 1, background: "#03994b" }} />
          <div style={{ flex: 1, background: "#f1b40f" }} />
          <div style={{ flex: 1, background: "#c7a84a" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 104,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              textTransform: "uppercase",
            }}
          >
            Kitengela Marines
          </div>
          <div style={{ marginTop: 24, fontSize: 34, color: "#8fe3b4" }}>
            Kitengela, Kajiado County
          </div>
        </div>

        <div style={{ fontSize: 28, color: "rgba(255,255,255,0.75)" }}>
          Fixtures · Results · Squads · News
        </div>
      </div>
    ),
    size,
  );
}
