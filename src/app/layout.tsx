import { Plus_Jakarta_Sans } from 'next/font/google';
import type { Metadata } from 'next';
import './globals.css';

const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fontDisplay = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Safety Training Video Creator',
  description: 'Create professional safety training videos from natural language',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(t!=='light'&&d))document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');})();`,
          }}
        />
      </head>
      <body
        className={`${fontSans.variable} ${fontDisplay.variable} font-sans antialiased min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
