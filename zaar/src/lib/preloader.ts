/** سكربت صغير يُحقن قبل الرسم: يخفي شاشة الافتتاح إن سبق عرضها في هذه الجلسة */
export const preloaderScript = (slug: string) =>
  `try{if(sessionStorage.getItem('zaar-seen:${slug.replace(/[^a-z0-9-]/g, "")}')){document.documentElement.classList.add('no-preload')}else{document.documentElement.classList.remove('no-preload')}}catch(e){}`;
