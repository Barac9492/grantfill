import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrantFill — 핵심만 쓰면, 반복은 채워집니다",
  description:
    "정부 출자사업 지원서 작성 도구. 창의적 핵심(Core)을 한 번 쓰면, 반복되는 섹션이 그 논지에서 일관되게 생성됩니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
