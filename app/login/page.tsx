'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { EASE } from '@/components/ui';
import { useStore } from '@/lib/store';

function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const { cloud, authed, ready, signIn, signUp, resetPassword, toast } = useStore();
  const [mode, setMode] = useState<'in' | 'up' | 'forgot'>('in');
  const [sent, setSent] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  // نرجع المستخدم للصفحة اللي جاء منها — روابط داخلية فقط
  const raw = params.get('next') ?? '/offers';
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/offers';

  useEffect(() => {
    if (ready && cloud && authed) router.replace(next);
  }, [ready, cloud, authed, next, router]);

  if (!cloud) {
    return (
      <div className="container page page-narrow empty">
        <h1 className="h2">نسخة تجريبية</h1>
        <p className="lead">تسجيل الدخول يشتغل بعد ربط قاعدة البيانات. الحين تقدر تجرّب كل شي بدون حساب.</p>
        <Link href="/new" className="btn btn-primary btn-lg">اعرض غرضك</Link>
      </div>
    );
  }

  const valid = email.includes('@') && (mode === 'forgot' || password.length >= 6) && (mode !== 'up' || name.trim().length > 1);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    if (mode === 'forgot') {
      const err = await resetPassword(email);
      if (err) setError(err);
      else setSent(true);
    } else if (mode === 'in') {
      const err = await signIn(email, password);
      if (err) setError(err);
      else toast('هلا بك');
    } else {
      const res = await signUp(name, email, password);
      if (res.error) setError(res.error);
      else if (res.confirm) setConfirm(true);
      else toast('تم إنشاء حسابك');
    }
    setBusy(false);
  };

  return (
    <div className="container page">
      <div className="auth">
        <header className="page-head">
          <span className="eyebrow">حسابك في حطّها</span>
          <h1 className="h2">{mode === 'in' ? 'هلا من جديد' : mode === 'up' ? 'حساب جديد' : 'نسيت كلمة المرور؟'}</h1>
        </header>

        {sent ? (
          <motion.div className="form-ok" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            لو {email} مسجّل عندنا، بيوصله رابط لتغيير كلمة المرور خلال دقايق. شيّك البريد غير المرغوب بعد.
            <button type="button" className="link-btn" onClick={() => { setSent(false); setMode('in'); }}>رجوع لتسجيل الدخول</button>
          </motion.div>
        ) : confirm ? (
          <motion.div className="form-ok" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            أرسلنا لك رابط تفعيل على {email}. افتحه ثم ارجع وسجّل دخولك.
          </motion.div>
        ) : (
          <form onSubmit={submit}>
            {mode === 'forgot' ? (
              <p className="lead forgot-lead">اكتب إيميلك ونرسل لك رابط تغيّر منه كلمة المرور.</p>
            ) : (
            <div className="tabs" role="tablist">
              {([['in', 'دخول'], ['up', 'حساب جديد']] as const).map(([id, label]) => (
                <button type="button" key={id} role="tab" aria-selected={mode === id} className={`tab ${mode === id ? 'is-on' : ''}`} onClick={() => { setMode(id); setError(''); }}>
                  {mode === id && <motion.span layoutId="auth-tab" className="tab-bg" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <span className="chip-in">{label}</span>
                </button>
              ))}
            </div>
            )}

            <AnimatePresence initial={false}>
              {mode === 'up' && (
                <motion.label className="field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: EASE }} style={{ overflow: 'hidden' }}>
                  <span className="label">اسمك</span>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم اللي يظهر للناس" autoComplete="name" maxLength={40} />
                </motion.label>
              )}
            </AnimatePresence>

            <label className="field">
              <span className="label">الإيميل</span>
              <input className="input" dir="ltr" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
            </label>
            {mode !== 'forgot' && (
            <label className="field">
              <span className="label">كلمة المرور</span>
              <input className="input" dir="ltr" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 أحرف أو أكثر" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required />
            </label>
            )}

            {error && <motion.div className="form-error" role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.div>}

            <button className="btn btn-primary btn-lg btn-block" disabled={!valid || busy}>
              {busy ? 'لحظة…' : mode === 'in' ? 'دخول' : mode === 'up' ? 'أنشئ الحساب' : 'أرسل الرابط'} <ArrowLeft size={18} />
            </button>
            {mode === 'in' && <button type="button" className="link-btn" onClick={() => { setMode('forgot'); setError(''); }}>نسيت كلمة المرور؟</button>}
            {mode === 'forgot' && <button type="button" className="link-btn" onClick={() => { setMode('in'); setError(''); }}>رجوع لتسجيل الدخول</button>}
            {mode === 'up' && (
              <p className="auth-note">
                بإنشاء الحساب أنت توافق على <Link href="/policies/terms">الشروط والأحكام</Link> و<Link href="/policies/privacy">سياسة الخصوصية</Link>.
              </p>
            )}
            <p className="auth-note">رقمك وإيميلك ما يظهرون لأحد. رقم الواتساب ينكشف فقط للي تتفق معه على بدل.</p>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense><Login /></Suspense>;
}
