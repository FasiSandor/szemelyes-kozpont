import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Személyes Központ",
  description: "Személyes, családi és vállalkozói digitális központ",
  applicationName: "Személyes Központ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Központ",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0F14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hu">
      <body>{children}</body>
    </html>
  );
}
