import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VETERAN CLUB",
  description: "길드 아이템 분배/출석/정산 관리",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="dark">
      <body>{children}</body>
    </html>
  );
}
