'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useStore } from '@/lib/store';

/** صفحة تغيير كلمة المرور — يوصلها المستخدم من الرابط اللي ينرسل على إيميله */
export default function ResetPage() {
  const router = useRouter();
  const { cloud, authed, ready, updatePassword, toast } = useStore();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);

  // Supabase يرجّع الخطأ في الرابط نفسه لو انتهت صلاحيته أو انفتح مرتين
  useEffect(() => {
    if (/error(_code)?=/.test(window.location.hash + window.location.search)) setExpired(true);
  }, []);

  const mismatch = again.length > 0 && password !== again;
  const valid = password.length >= 6 && password === again;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    const err = await updatePassword(password);
    if (err) {
      setError(err);
      setBusy(false);
      return;
    }
    toast('تغيّرت كلمة المرور');
    router.replace('/offers');
  };

  if (!ready) return <div className="container page"><div className="auth"><div className="skeleton" /></div></div>;

  if (!cloud || expired || !authed) {
    return (
      <div className="container page page-narrow empty">
        <h1 className="h2">{cloud ? 'الرابط منتهي أو غير صالح' : 'نسخة تجريبية'}</h1>
        <p className="lead">
          {cloud ? 'رابط تغيير كلمة المرور يشتغل مرة واحدة ولمدة محدودة. اطلب رابط جديد.' : 'تغيير كلمة المرور يشتغل بعد ربط قاعدة البيانات.'}
        </p>
        <Link href="/login" className="btn btn-primary btn-lg">صفحة الدخول</Link>
      </div>
    );
  }

  return (
    <div className="container page">
      <form className="auth" onSubmit={submit}>
        <header className="page-head">
          <span className="eyebrow">حسابك في حطّها</span>
          <h1 className="h2">كلمة مرور جديدة</h1>
        </header>
        <label className="field">
          <span className="label">كلمة المرور الجديدة</span>
          <input className="input" dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 أحرف أو أكثر" autoComplete="new-password" minLength={6} autoFocus required />
        </label>
        <label className="field">
          <span className="label">أعد كتابتها</span>
          <input className="input" dir="ltr" type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" minLength={6} aria-invalid={mismatch} required />
        </label>
        {(mismatch || error) && (
          <motion.div className="form-error" role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {mismatch ? 'الكلمتين مو متطابقتين' : error}
          </motion.div>
        )}
        <button className="btn btn-primary btn-lg btn-block" disabled={!valid || busy}>
          {busy ? 'لحظة…' : 'احفظ كلمة المرور'} <ArrowLeft size={18} />
        </button>
      </form>
    </div>
  );
}
