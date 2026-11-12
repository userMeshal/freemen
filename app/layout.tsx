import type { Metadata, Viewport } from 'next';
import '@fontsource/ibm-plex-sans-arabic/300.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-sans-arabic/700.css';
import './globals.css';
import Chrome from '@/components/Chrome';

export const metadata: Metadata = {
  title: { default: 'بدلني — سوق المقايضة السعودي', template: '%s — بدلني' },
  applicationName: 'بدلني',
  description: 'اعرض غرضك، استقبل عروض البدل، وبدّل اللي عندك باللي تبيه. مقايضة غرض بغرض في كل مدن السعودية — بدون ولا ريال.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0c' },
  ],
};

const themeScript = `try{var t=localStorage.getItem('badal:theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Chrome>{children}</Chrome>
      </body>
    </html>
  );
}
