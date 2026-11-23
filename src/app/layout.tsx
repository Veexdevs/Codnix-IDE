import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CODNIX IDE',
  description: 'Ambiente de desenvolvimento profissional com múltiplas inteligências artificiais — OpenRouter, editor Monaco, terminal real e colaboração entre IAs.',
  applicationName: 'CODNIX IDE',
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0a0a0b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-accent="blue">
      <body className="font-sans text-ink">{children}</body>
    </html>
  );
}
