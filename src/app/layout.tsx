import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { PwaRegistration } from "@/components/PwaRegistration";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#047857",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "CupomHub",
  description: "Escaneie QR codes de cupons fiscais, organize produtos e acompanhe seus gastos",
  applicationName: "CupomHub",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CupomHub",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  verification: {
    google: "PWQZQrpLxZLdNXzOs82MdU7erUkExF_1mi4VQip8w_o",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="google-site-verification" content="PWQZQrpLxZLdNXzOs82MdU7erUkExF_1mi4VQip8w_o" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <PwaRegistration />
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
