import type { MetadataRoute } from 'next';

/** بيانات تثبيت الموقع كتطبيق على الجوال (الشاشة الرئيسية) */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'حطّها — بدّل، بِع، وزاوِد',
    short_name: 'حطّها',
    description: 'سوق واحد لكل أغراضك في السعودية: بدّلها بغرض ثاني، بيعها بسعرك، أو اعرضها بمزاد.',
    lang: 'ar',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#111226',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
