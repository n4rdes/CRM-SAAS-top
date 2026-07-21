import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Prismae | CRM, ATS e Gestão de Pessoas",
    template: "%s | Prismae",
  },
  description:
    "Uma plataforma para consultorias e empresas conectarem clientes, vagas, candidatos e colaboradores em toda a jornada de pessoas.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
