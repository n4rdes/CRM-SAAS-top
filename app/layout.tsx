import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Prismae | CRM, ATS, Desempenho e Gestão de Pessoas",
    template: "%s | Prismae",
  },
  description:
    "Centralize CRM, recrutamento, colaboradores, desempenho, clima e eNPS. Uma única operação para consultorias de RH e empresas.",
  keywords: ["CRM para RH", "ATS", "software de recrutamento", "gestão de pessoas", "eNPS", "desempenho", "People Analytics"],
  alternates: { canonical: "/" },
  openGraph: { title: "Prismae People OS", description: "Pare de perder informação entre sistemas. Conecte CRM, ATS, Pessoas, Desempenho e Clima.", url: "/", siteName: "Prismae", locale: "pt_BR", type: "website" },
  twitter: { card: "summary", title: "Prismae People OS", description: "Todo o ciclo de pessoas em uma única operação." },
  robots: { index: true, follow: true },
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
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
