import { useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { api, errMsg } from '../lib/api';
import { homeFor, useAuth } from '../lib/store';
import { Logo, LogoMark } from '../components/Logo';
import { LangToggle } from '../components/Common';
import { t } from '../lib/i18n';
import { ReactNode } from 'react';

function Shell({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-forest p-10 text-ivory lg:flex">
        <Logo light size={40} />
        <div>
          <p className="font-display text-4xl font-extrabold leading-tight">The Operating System<br />for Education.</p>
          <p className="mt-3 max-w-sm text-sand/80">One secure place for admissions, attendance, fees, exams and everything your school runs on.</p>
        </div>
        <p className="text-xs text-sand/60">Dedicated to a single school.</p>
      </div>
      <div className="relative flex items-center justify-center p-6"><div className="absolute end-4 top-4"><LangToggle /></div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="mb-6 lg:hidden"><Logo /></div>
          <h1 className="text-2xl font-extrabold">{t(title)}</h1>
          {sub && <p className="mb-5 mt-1 text-sm opacity-70">{t(sub)}</p>}
          {children}
        </motion.div>
      </div>
    </div>
  );
}

export function Login() {
  const nav = useNavigate(); const login = useAuth((s) => s.login); const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') })) });
  return (
    <Shell title="Sign in" sub="Use the account created for you by the school office.">
      <form className="space-y-4" onSubmit={handleSubmit(async (v) => { setErr(''); try { const u = await login(v.email, v.password); nav(homeFor(u.role)); } catch (e) { setErr(errMsg(e)); } })}>
        <div><label className="label" htmlFor="email">{t('Email')}</label><input id="email" className="input" type="email" autoComplete="username" {...register('email')} />{errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message as string}</p>}</div>
        <div><label className="label" htmlFor="password">{t('Password')}</label><input id="password" className="input" type="password" autoComplete="current-password" {...register('password')} />{errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message as string}</p>}</div>
        {err && <p className="rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">{err}</p>}
        <button className="btn w-full" disabled={isSubmitting}>{isSubmitting && <Loader2 size={14} className="animate-spin" />}{t('Sign in')}</button>
        <div className="flex justify-between text-sm"><Link className="underline" to="/forgot">{t('Forgot password?')}</Link><Link className="underline" to="/">{t('School website')}</Link></div>
      </form>
    </Shell>
  );
}

export function Forgot() {
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ email: string }>();
  return (
    <Shell title="Reset your password" sub="Enter your account email and we will send a reset link.">
      {msg ? <p className="rounded bg-forest-50 p-3 text-sm text-forest dark:bg-charcoal dark:text-sand">{msg}</p> : (
        <form className="space-y-4" onSubmit={handleSubmit(async (v) => { setErr(''); try { setMsg((await api.post('/auth/forgot', v)).data.message); } catch (e) { setErr(errMsg(e)); } })}>
          <div><label className="label" htmlFor="e">Email</label><input id="e" type="email" required className="input" {...register('email')} /></div>
          {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
          <button className="btn w-full" disabled={isSubmitting}>{t('Send reset link')}</button>
        </form>)}
      <p className="mt-4 text-sm"><Link className="underline" to="/login">{t('Back to sign in')}</Link></p>
    </Shell>
  );
}

const pwSchema = z.object({ password: z.string().min(10, 'At least 10 characters').regex(/[a-z]/, 'Add a lowercase letter').regex(/[A-Z]/, 'Add an uppercase letter').regex(/\d/, 'Add a number') });
export function Reset() {
  const { token } = useParams(); const nav = useNavigate(); const [err, setErr] = useState(''); const [done, setDone] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(pwSchema) });
  return (
    <Shell title="Choose a new password" sub="At least 10 characters with upper case, lower case and a number.">
      {done ? <p className="rounded bg-forest-50 p-3 text-sm text-forest dark:bg-charcoal dark:text-sand">Password updated. <Link className="underline" to="/login">Sign in</Link></p> : (
        <form className="space-y-4" onSubmit={handleSubmit(async (v) => { setErr(''); try { await api.post(`/auth/reset/${token}`, v); setDone(true); setTimeout(() => nav('/login'), 1500); } catch (e) { setErr(errMsg(e)); } })}>
          <div><label className="label" htmlFor="p">New password</label><input id="p" type="password" autoComplete="new-password" className="input" {...register('password')} />{errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message as string}</p>}</div>
          {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
          <button className="btn w-full" disabled={isSubmitting}>{t('Update password')}</button>
        </form>)}
    </Shell>
  );
}
