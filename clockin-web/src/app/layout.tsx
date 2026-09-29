import type { Metadata } from 'next';
import { ToastProvider } from '@/components/common/Toast';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sera Neon · ClockIn',
  description: 'Sera Neon time tracking',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
      { url: '/icon.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: [{ url: '/icon.png', type: 'image/png' }],
    shortcut: [{ url: '/favicon.ico' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="h-full overflow-hidden antialiased">
        <div className="h-full">
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </div>
      </body>
    </html>
  );
}
