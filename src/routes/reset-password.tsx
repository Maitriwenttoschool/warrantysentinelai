import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [
    { title: 'Reset Password — Warranty Sentinel' },
    { name: 'description', content: 'Reset your Warranty Sentinel reviewer password.' },
    { property: 'og:title', content: 'Reset Password — Warranty Sentinel' },
    { property: 'og:description', content: 'Secure password recovery for Warranty Sentinel.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: ResetPassword,
});
function ResetPassword() {
  const [recovery, setRecovery] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get('type') === 'recovery') { sessionStorage.setItem('warranty-password-recovery', 'true'); setRecovery(true); }
    else setRecovery(sessionStorage.getItem('warranty-password-recovery') === 'true');
  }, []);
  return <main className="min-h-screen bg-background px-6 py-20"><div className="mx-auto max-w-sm space-y-6">
    <h1 className="text-3xl font-semibold">Warranty Sentinel</h1><h2 className="text-lg">Reset password</h2>
    {done ? <p role="status" className="text-success">Password updated.</p> : !recovery ? <p className="text-muted-foreground">Open the password reset link from your email.</p> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); void (async () => {
      setBusy(true); setError('');
      try {
        if (password !== confirm) throw new Error('Passwords do not match.');
        const { error: resetError } = await supabase.auth.updateUser({ password });
        if (resetError) throw resetError;
        sessionStorage.removeItem('warranty-password-recovery'); setPassword(''); setConfirm(''); setDone(true);
      } catch (e) { setError(e instanceof Error ? e.message : 'Password could not be reset.'); }
      finally { setBusy(false); }
    })(); }}>
      <label className="block space-y-2 text-sm">New password<Input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label className="block space-y-2 text-sm">Confirm password<Input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
      <Button type="submit" variant="navy" disabled={busy}>Set password</Button>
    </form>}
    {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    <Button asChild variant="link"><Link to="/auth">Back to sign-in</Link></Button>
  </div></main>;
}