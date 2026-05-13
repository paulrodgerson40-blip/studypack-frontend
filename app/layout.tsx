import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyPack.ai",
  description: "Premium AI tutor-grade university study packs",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/studypack-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
