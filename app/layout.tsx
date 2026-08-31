import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-plus-jakarta"
});

export const metadata: Metadata = {
  title: "Miranda's Pet Boutique | Grooming",
  description: "Operacion de grooming para pet stores en Guatemala"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es-GT">
      <body className={`${plusJakartaSans.variable} ${plusJakartaSans.className}`}>{children}</body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
