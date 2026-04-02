import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/Header';

export const metadata: Metadata = {
  title: "Ray's Retreat — Validate your idea in 48 hours",
  description:
    'Get 5 real-user interviews in 48 hours. Know if your idea is worth building before you waste months on it.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface text-ink antialiased">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
