import './globals.css';
import type { Metadata } from 'next';
import { Unbounded, Golos_Text, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '../lib/auth';

const display = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-unbounded',
  display: 'swap',
});
const sans = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-golos',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '700'],
  variable: '--font-jbmono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AximaVPN — быстрый VPN только для нужных сервисов',
  description: 'WireGuard-VPN с раздельным туннелированием: Telegram, YouTube, Instagram, ChatGPT и другие сервисы — без замедления остального трафика.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
