import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: {
    template: "%s | Pramuka CAT",
    default: "Pramuka CAT — Sistem Ujian Digital",
  },
  description:
    "Platform Computer Assisted Test (CAT) untuk kegiatan kepramukaan. Ujian digital yang objektif, transparan, dan efisien.",
  keywords: ["pramuka", "ujian", "CAT", "computer assisted test", "digital"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="h-full">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
