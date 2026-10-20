import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
      <svg width="132" height="132" viewBox="0 0 64 64">
        <g transform="translate(2 -3.6) scale(1 1.13)">
          <path d="M14 13.5a3.5 3.5 0 0 1 3.5-3.5H24v15.2l13.6 7.3a1.4 1.4 0 0 1 0 2.5L19.5 50.6A3.6 3.6 0 0 1 14 47.6z" fill="#1c3260" />
          <path d="M24 31.6v9.4l8.4-4.7z" fill="#ffffff" />
          <path d="M26.5 10.5l23.6 19.7a2.3 2.3 0 0 1 0 3.5L33.6 47.6a2.6 2.6 0 0 1-3.9-3.3l11.1-11.1a1.5 1.5 0 0 0 0-2.1z" fill="#ec2a2f" />
        </g>
      </svg>
    </div>,
    size,
  );
}
