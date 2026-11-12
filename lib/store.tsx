'use client';

import { CloudProvider, supabase } from './cloud';
import { LocalProvider } from './local';

export { fileToDataUrl, useStore } from './ctx';

/** لو متغيرات Supabase مضبوطة نستخدم القاعدة الحقيقية، وإلا الوضع التجريبي المحلي */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  return supabase ? <CloudProvider>{children}</CloudProvider> : <LocalProvider>{children}</LocalProvider>;
}
