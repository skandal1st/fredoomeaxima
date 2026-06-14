import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '../lib/auth';

export const metadata: Metadata = {
  title: 'AximaVPN',
  description: 'WireGuard VPN with split tunneling',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
