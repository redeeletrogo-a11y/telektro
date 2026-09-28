import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 40, background: "#0f776c", color: "white", fontSize: 132, fontWeight: 700, letterSpacing: -12 }}>
      T<span style={{ marginLeft: -4, color: "#bcebd1", fontSize: 54 }}>ϟ</span>
    </div>,
    size,
  );
}
