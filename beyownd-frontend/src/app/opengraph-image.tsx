import { ImageResponse } from "next/og";
import { OgCard, ogSize } from "@/components/og/og-card";

export const alt = "Beyownd: virtual internships your college can trust";
export const size = ogSize;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <OgCard eyebrow="Virtual internship programs" title="Earn an internship your college can trust" footer="Mentor-reviewed project · Verifiable certificate" />,
    size,
  );
}
