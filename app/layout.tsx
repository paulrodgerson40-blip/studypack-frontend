import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "StudyPack.ai — Elite AI Study Packs",
    template: "%s | StudyPack.ai",
  },
  description: "Upload your lecture material. Get a premium tutor-style StudyPack — hotspots, deep notes, model answers, attack sheet and more.",
  icons: {
    icon: "/favicon.png",
    apple: "/studypack-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
