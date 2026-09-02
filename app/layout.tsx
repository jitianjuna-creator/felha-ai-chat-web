import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ayu 聊天测试",
  description: "Felha companion chat test page",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full bg-[#f5f5f5] text-[#222222] antialiased">{children}</body>
    </html>
  );
}
