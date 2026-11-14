import { ImageResponse } from "next/og";

export const alt = "PUFF SAUDI — أكواب بف";
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
          background: "#0B0B0C",
          color: "#D7FF3E",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, letterSpacing: 10, color: "#F5F1E8" }}>PUFF SAUDI</div>
        <div style={{ display: "flex", fontSize: 330, fontWeight: 900, letterSpacing: -18, lineHeight: 0.8 }}>PUFF</div>
        <div style={{ display: "flex", fontSize: 30, color: "#F5F1E8" }}>COLOR IS A MOOD — puffsaudi</div>
      </div>
    ),
    size,
  );
}
