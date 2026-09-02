import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "阿柚聊天测试",
  description: "Felha 拟人短信测试页",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full bg-[#f5f5f5] text-[#222222] antialiased">{children}</body>
    </html>
  );
}
