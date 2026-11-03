import type { Metadata, Viewport } from "next";
import { Federo, Jost, Limelight } from "next/font/google";
import "./globals.css";

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
});

const federo = Federo({
  variable: "--font-federo",
  subsets: ["latin"],
  weight: "400",
});

const limelight = Limelight({
  variable: "--font-limelight",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Traitors: The Game",
  description: "A private, phone-first game of The Traitors for one room of invited guests.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#00474c",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${jost.variable} ${federo.variable} ${limelight.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
