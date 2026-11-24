import { ReactNode, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { api, dateStr, errMsg } from '../../lib/api';
import { Logo } from '../../components/Logo';
import { SchoolLogo, LangToggle } from '../../components/Common';
import { t } from '../../lib/i18n';

const useSite = () => useQuery({ queryKey: ['site'], queryFn: async () => (await api.get('/public/site')).data });
const Reveal = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <motion.div className={className} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.4 }}>{children}</motion.div>
);
const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mx-auto max-w-5xl px-4 py-12"><Reveal><h2 className="mb-4 text-2xl font-extrabold text-forest dark:text-sand">{t(title)}</h2>{children}</Reveal></section>
);
const Blank = ({ what }: { what: string }) => <p className="text-charcoal/60 dark:text-sand/60">{what} has not been added yet. The school office can add it under School settings.</p>;

export function PublicLayout() {
  const { data } = useSite(); const [open, setOpen] = useState(false);
  const links = [['/', 'Home'], ['/about', 'About'], ['/academics', 'Academics'], ['/admissions', 'Admissions'], ['/news', 'News & events'], ['/contact', 'Contact']];
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-sand bg-ivory/90 backdrop-blur dark:border-charcoal dark:bg-charcoal-900/90">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold text-forest dark:text-sand"><SchoolLogo site={data} h={36} />{data?.schoolName || 'Our School'}</Link>
          <nav className="hidden items-center gap-5 text-sm font-medium md:flex" aria-label="Public">
            {links.map(([to, l]) => <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'text-forest underline underline-offset-4 dark:text-sage-300' : 'hover:underline')}>{t(l)}</NavLink>)}
            <LangToggle /><Link to="/login" className="btn !py-1.5">{t('Portal sign-in')}</Link>
          </nav>
          <button className="btn-ghost !p-2 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X size={18} /> : <Menu size={18} />}</button>
        </div>
        {open && <nav className="flex flex-col gap-1 border-t border-sand p-3 md:hidden dark:border-charcoal">{links.map(([to, l]) => <Link key={to} to={to} onClick={() => setOpen(false)} className="rounded px-3 py-2 hover:bg-sand-200 dark:hover:bg-charcoal">{t(l)}</Link>)}<div className="flex gap-2"><LangToggle /><Link to="/login" className="btn mt-1 flex-1">{t('Portal sign-in')}</Link></div></nav>}
      </header>
      <main><Outlet /></main>
      <footer className="mt-10 bg-forest px-4 py-8 text-sand">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 text-sm">
          <div><p className="font-bold">{data?.schoolName}</p><p className="opacity-80">{data?.address}</p></div>
          <Logo light size={28} />
        </div>
      </footer>
    </div>
  );
}

export function Home() {
  const { data } = useSite();
  return (<>
    <section className="bg-forest text-ivory">
      <div className="mx-auto max-w-5xl px-4 py-20">
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl text-4xl font-extrabold leading-tight md:text-5xl">{data?.tagline || data?.schoolName || 'Welcome'}</motion.h1>
        {data?.about && <p className="mt-4 max-w-xl text-sand/90">{data.about.slice(0, 220)}{data.about.length > 220 ? '…' : ''}</p>}
        <div className="mt-8 flex gap-3"><Link to="/admissions" className="btn !bg-sand !text-forest">{t('Apply for admission')}</Link><Link to="/about" className="btn-ghost !border-sand/40 !text-sand">{t('Learn more')}</Link></div>
      </div>
    </section>
    {data?.principalMessage && <Section title={`A message from ${data.principalName || 'our principal'}`}><p className="max-w-3xl whitespace-pre-line leading-relaxed">{data.principalMessage}</p></Section>}
    {!!data?.events?.length && <Section title="Upcoming events"><ul className="grid gap-3 sm:grid-cols-2">{data.events.map((e: any) => <li key={e._id} className="card p-4"><p className="text-xs font-semibold text-sage">{dateStr(e.eventDate)}</p><p className="font-bold">{e.title}</p></li>)}</ul></Section>}
  </>);
}

export const About = () => { const { data } = useSite(); return <Section title="About the school">{data?.about ? <p className="max-w-3xl whitespace-pre-line leading-relaxed">{data.about}</p> : <Blank what="The school description" />}{!!data?.facilities?.length && <><h3 className="mb-2 mt-8 text-lg font-bold">Facilities</h3><ul className="grid gap-2 sm:grid-cols-2">{data.facilities.map((f: string) => <li key={f} className="card px-4 py-3 text-sm">{f}</li>)}</ul></>}</Section>; };
export const Academics = () => { const { data } = useSite(); return <Section title="Academic programs">{data?.programs?.length ? <ul className="grid gap-3 sm:grid-cols-2">{data.programs.map((p: string) => <li key={p} className="card p-4 font-medium">{p}</li>)}</ul> : <Blank what="Academic programs" />}</Section>; };

export function Admissions() {
  const { data } = useSite(); const [done, setDone] = useState(''); const [err, setErr] = useState('');
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<any>();
  return (
    <Section title="Admissions">
      {data?.admissionsInfo ? <p className="mb-8 max-w-3xl whitespace-pre-line leading-relaxed">{data.admissionsInfo}</p> : <div className="mb-8"><Blank what="Admissions information" /></div>}
      <div className="card max-w-xl p-5">
        <h3 className="mb-3 text-lg font-bold">{t('Admission inquiry')}</h3>
        {done ? <p className="rounded bg-forest-50 p-3 text-sm text-forest dark:bg-charcoal dark:text-sand" role="status">{done}</p> : (
          <form className="space-y-3" onSubmit={handleSubmit(async (v) => { setErr(''); try { const r = await api.post('/public/inquiry', v); setDone(r.data.message); reset(); } catch (e) { setErr(errMsg(e)); } })}>
            <div><label className="label" htmlFor="n">{t('Parent / guardian name *')}</label><input id="n" className="input" required {...register('name')} /></div>
            <div className="grid gap-3 sm:grid-cols-2"><div><label className="label" htmlFor="ph">{t('Phone *')}</label><input id="ph" className="input" required type="tel" {...register('phone')} /></div><div><label className="label" htmlFor="em">{t('Email')}</label><input id="em" className="input" type="email" {...register('email')} /></div></div>
            <div><label className="label" htmlFor="cl">{t('Class applying for')}</label><input id="cl" className="input" {...register('classApplying')} /></div>
            <div><label className="label" htmlFor="ms">{t('Message')}</label><textarea id="ms" rows={3} className="input" {...register('message')} /></div>
            {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
            <button className="btn" disabled={isSubmitting}>{t('Send inquiry')}</button>
          </form>)}
      </div>
    </Section>
  );
}

export function News() {
  const { data } = useQuery({ queryKey: ['news'], queryFn: async () => (await api.get('/public/news')).data.items });
  const site = useSite();
  return (
    <Section title="News & events">
      {!data?.length ? <p className="opacity-60">No news has been published yet.</p> : <ul className="space-y-3">{data.map((n: any) => <li key={n._id} className="card p-4"><p className="text-xs text-sage">{dateStr(n.createdAt)}</p><h3 className="font-bold">{n.title}</h3><p className="mt-1 whitespace-pre-line text-sm">{n.body}</p></li>)}</ul>}
      {!!site.data?.events?.length && <><h3 className="mb-2 mt-8 text-lg font-bold">Upcoming events</h3><ul className="space-y-2">{site.data.events.map((e: any) => <li key={e._id} className="card flex justify-between p-3 text-sm"><span>{e.title}</span><span className="opacity-60">{dateStr(e.eventDate)}</span></li>)}</ul></>}
    </Section>
  );
}

export const Contact = () => { const { data } = useSite(); return <Section title="Contact us">{data?.address || data?.phone || data?.email ? <dl className="card divide-y divide-sand text-sm dark:divide-charcoal">{[['Address', data.address], ['Phone', data.phone], ['Email', data.email]].filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-3"><dt className="opacity-60">{k}</dt><dd className="text-right">{v}</dd></div>)}</dl> : <Blank what="Contact information" />}</Section>; };
