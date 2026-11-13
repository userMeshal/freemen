'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { ArrowLeft, Camera, Handshake, MessagesSquare, Scale, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import HeroSwap from '@/components/HeroSwap';
import { CategoryIcon, Counter, EASE, ListingCard, Reveal } from '@/components/ui';
import { CATEGORIES, CITIES, auctionEnded } from '@/lib/data';
import { PLEDGE } from '@/lib/pledge';
import { SITE } from '@/lib/site';
import { useStore } from '@/lib/store';

const HEADLINE = ['بدّل.', 'بِع.', 'زاوِد.'];

const MANIFESTO =
  'في كل بيت أغراض قيمتها محفوظة وفايدتها واقفة. تليته يحرّكها بثلاث طرق: بدّلها بغرض تحتاجه، بيعها بالسعر اللي تحدده، أو حطها بمزاد وأعلى مزايدة تاخذها.';

function Word({ children, progress, range }: { children: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  return <motion.span style={{ opacity }}>{children} </motion.span>;
}

function Manifesto() {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] });
  const words = MANIFESTO.split(' ');
  return (
    <section className="section container">
      <p ref={ref} className="manifesto">
        {words.map((w, i) => (
          <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>{w}</Word>
        ))}
      </p>
    </section>
  );
}

const STEPS = [
  { icon: Camera, title: 'اعرض غرضك', text: 'صوّره واختر الطريقة: بدل بغرض ثاني، بيع بسعر ثابت، أو مزاد.' },
  { icon: MessagesSquare, title: 'استقبل العروض', text: 'عروض بدل، طلبات شراء، أو مزايدات — كلها توصلك في مكان واحد.' },
  { icon: Handshake, title: 'اتفقوا وسلّموا', text: 'اقبل العرض اللي يعجبك، تواصلوا، وتقابلوا في مكان عام. خلاص.' },
];

function How() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.6'] });
  return (
    <section className="section container" id="how">
      <Reveal>
        <span className="eyebrow">كيف يشتغل</span>
        <h2 className="h2">ثلاث خطوات.<br />وخلصت.</h2>
      </Reveal>
      <div className="steps" ref={ref}>
        <div className="steps-line"><motion.span style={{ scaleX: scrollYProgress }} /></div>
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.12} className="step">
            <motion.div className="step-icon" whileHover={{ rotate: -8, scale: 1.08 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
              <s.icon size={26} strokeWidth={1.5} />
            </motion.div>
            <span className="step-num">0{i + 1}</span>
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Bento() {
  return (
    <section className="section container">
      <Reveal>
        <span className="eyebrow">ليش تليته</span>
        <h2 className="h2">ثلاث طرق،<br />وسوق واحد.</h2>
      </Reveal>
      <div className="bento">
        <Reveal className="tile tile-dark tile-wide">
          <Wallet size={26} strokeWidth={1.5} />
          <div className="tile-big"><Counter to={PLEDGE.fee} /> <small>ريال بعد البيع</small></div>
          <h3>النشر مجاني، والرسم بعد البيع فقط</h3>
          <p>ما تدفع شي عند النشر. لو تم البيع عن طريق الموقع، رسم ثابت {PLEDGE.fee} ريال — مو نسبة من السعر. والمزادات لها رسومها: {SITE.listingFee} ريال للعرض و{SITE.auctionFee} ريال للدخول.</p>
          <div className="tile-glow" />
        </Reveal>
        <Reveal className="tile" delay={0.08}>
          <Scale size={26} strokeWidth={1.5} />
          <div className="scale" aria-hidden>
            <motion.div className="scale-beam" animate={{ rotate: [-7, 7, -3, 0] }} transition={{ duration: 4, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }}>
              <span /><span />
            </motion.div>
          </div>
          <h3>ميزان البدل</h3>
          <p>يحسب قيمة الغرض والمبلغ المضاف ويوضّح لك إذا البدلة عادلة للطرفين.</p>
        </Reveal>
        <Reveal className="tile tile-tagged" delay={0.14}>
          <Sparkles size={26} strokeWidth={1.5} />
          <h3>اطلب بدل محدد</h3>
          <p>حدّد بالضبط وش تبي مقابل غرضك، أو استقبل كل العروض واختر الأحسن.</p>
          <div className="tile-tags">
            {['بلايستيشن 5', 'ماك بوك', 'آيفون', 'دراجة'].map((t, i) => (
              <motion.span key={t} className="chip" animate={{ y: [0, -5, 0] }} transition={{ duration: 3, delay: i * 0.4, repeat: Infinity, ease: 'easeInOut' }}>{t}</motion.span>
            ))}
          </div>
        </Reveal>
        <Reveal className="tile" delay={0.08}>
          <ShieldCheck size={26} strokeWidth={1.5} />
          <h3>بدل بأمان</h3>
          <p>تقابلوا في مكان عام، افحصوا الغرض، وسلّموا يد بيد. لا تحوّل مبلغ قبل ما تستلم.</p>
        </Reveal>
        <Reveal className="tile tile-wide tile-cities" delay={0.14}>
          <h3>من تبوك إلى جازان</h3>
          <p>عروض بدل في كل مدن المملكة — فلتر بمدينتك وبدّل مع جيرانك.</p>
          <div className="marquee marquee-sm" aria-hidden>
            <div className="marquee-track">
              {[...CITIES, ...CITIES].map((c, i) => <span key={i} className="chip">{c}</span>)}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function Home() {
  const { all, ready } = useStore();
  const liveAuctions = all.filter((l) => l.kind === 'auction' && l.endsAt && !auctionEnded(l)).slice(0, 4);
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const orbY = useTransform(scrollYProgress, [0, 1], [0, 180]);
  const visualY = useTransform(scrollYProgress, [0, 1], [0, -60]);

  return (
    <>
      <section className="hero" ref={heroRef}>
        <motion.div className="orbs" style={{ y: orbY }} aria-hidden>
          <span className="orb orb-1" /><span className="orb orb-2" /><span className="orb orb-3" />
        </motion.div>
        <div className="container hero-grid">
          <div className="hero-copy">
            <motion.span className="pill" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
              <span className="pill-dot" /> بدل · بيع · مزاد
            </motion.span>
            <h1 className="h1" aria-label={HEADLINE.join(' ')}>
              {HEADLINE.map((w, i) => (
                <span key={i} className="h1-mask" aria-hidden>
                  <motion.span initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.1 + i * 0.09 }}>
                    {w}
                  </motion.span>
                </span>
              ))}
            </h1>
            <motion.p className="lead" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.65 }}>
              سوق واحد لكل أغراضك: بدّلها بغرض ثاني، بيعها بسعرك، أو اعرضها بمزاد وخلّ الناس يزاودون.
            </motion.p>
            <motion.div className="hero-cta" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.8 }}>
              <Link href="/new" className="btn btn-primary btn-lg">اعرض غرضك <ArrowLeft size={18} /></Link>
              <Link href="/browse" className="btn btn-ghost btn-lg">تصفّح العروض</Link>
            </motion.div>
          </div>
          <motion.div className="hero-visual" style={{ y: visualY }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1, ease: EASE, delay: 0.4 }}>
            <HeroSwap />
          </motion.div>
        </div>
      </section>

      <section className="marquee" aria-label="الأقسام">
        <div className="marquee-track">
          {[...CATEGORIES, ...CATEGORIES].map((c, i) => (
            <Link key={i} href={`/browse?cat=${c.id}`} className="marquee-item" tabIndex={i >= CATEGORIES.length ? -1 : 0}>
              <CategoryIcon id={c.id} size={22} /> {c.name}
            </Link>
          ))}
        </div>
      </section>

      <Manifesto />
      <How />

      {liveAuctions.length > 0 && (
        <section className="section container">
          <Reveal className="section-head">
            <div>
              <span className="eyebrow">مزادات</span>
              <h2 className="h2">سجّل قبل ما يبدأ،<br />وزاوِد قبل ما يخلص.</h2>
            </div>
            <Link href="/browse?kind=auction" className="btn btn-ghost">كل المزادات <ArrowLeft size={16} /></Link>
          </Reveal>
          <div className="grid">
            {liveAuctions.map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}
          </div>
        </section>
      )}

      <section className="section container">
        <Reveal className="section-head">
          <div>
            <span className="eyebrow">معروض الآن</span>
            <h2 className="h2">جديد السوق.</h2>
          </div>
          <Link href="/browse" className="btn btn-ghost">كل العروض <ArrowLeft size={16} /></Link>
        </Reveal>
        <div className="grid">
          {all.slice(0, 8).map((l, i) => <ListingCard key={l.id} listing={l} index={i} />)}
        </div>
        {ready && all.length === 0 && (
          <div className="empty">
            <h3>السوق توّه فاتح</h3>
            <p>كن أول من يعرض غرض على تليته.</p>
            <Link href="/new" className="btn btn-primary">اعرض غرضك</Link>
          </div>
        )}
      </section>

      <Bento />

      <section className="section container">
        <div className="stats">
          {[
            { n: 3, s: '', l: 'طرق للعرض' },
            { n: CATEGORIES.length, s: '', l: 'قسم' },
            { n: 13, s: '', l: 'منطقة في المملكة' },
            { n: SITE.auctionFee, s: '', l: 'ريال دخول المزاد' },
          ].map((x, i) => (
            <Reveal key={x.l} delay={i * 0.08} className="stat">
              <strong><Counter to={x.n} suffix={x.s} /></strong>
              <span>{x.l}</span>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container">
        <Reveal className="cta">
          <div className="cta-orbs" aria-hidden><span className="orb orb-1" /><span className="orb orb-2" /></div>
          <h2>عندك شي ما عاد تحتاجه؟</h2>
          <p>غيرك يدوّر عليه — وعنده اللي تدوّر عليه.</p>
          <Link href="/new" className="btn btn-light btn-lg">اعرض أول غرض <ArrowLeft size={18} /></Link>
        </Reveal>
      </section>
    </>
  );
}
