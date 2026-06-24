import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyPetStore Grooming",
  description: "Operacion de grooming para pet stores en Guatemala"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es-GT">
      <body>{children}</body>
    </html>
  );
}
