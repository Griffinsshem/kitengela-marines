import { ImageResponse } from "next/og";

/** The same mark at the size iOS uses when the site is saved to a home screen. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#011e0f",
          color: "#ffffff",
          fontSize: 82,
          fontWeight: 800,
          letterSpacing: "-0.04em",
        }}
      >
        KM
        <div style={{ display: "flex", width: 96, height: 10, marginTop: 14 }}>
          <div style={{ flex: 1, background: "#03994b" }} />
          <div style={{ flex: 1, background: "#f1b40f" }} />
          <div style={{ flex: 1, background: "#c7a84a" }} />
        </div>
      </div>
    ),
    size,
  );
}
