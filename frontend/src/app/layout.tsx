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
        {/* Anti-Piracy Watermark: Tersembunyi dari layar namun terlihat jelas di Inspect Element (DOM) */}
        <div style={{ display: "none" }} data-author="Aliube" data-license="Proprietary Non-Commercial">
          Pramuka CAT is developed and owned by Aliube. Unauthorized commercial use is strictly prohibited.
        </div>
      </body>
    </html>
  );
}
