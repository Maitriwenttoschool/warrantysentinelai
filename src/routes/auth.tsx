import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lovable } from '@/integrations/lovable';
import { useReviewer } from '@/hooks/reviewer';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

export const Route = createFileRoute('/auth')({
  head: () => ({ meta: [
    { title: 'Reviewer Sign-in — Warranty Sentinel' },
    { name: 'description', content: 'Sign in to your Warranty Sentinel reviewer account.' },
    { property: 'og:title', content: 'Reviewer Sign-in — Warranty Sentinel' },
    { property: 'og:description', content: 'Secure access to your warranty claims and audit records.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: SignIn,
});

function SignIn() {
  const { user } = useReviewer();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { if (user) void navigate({ to: '/', replace: true }); }, [user, navigate]);
  async function signIn() {
    setBusy(true); setError('');
    try {
      const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin });
      if (result.error) setError(result.error.message);
    } catch { setError('Sign-in could not complete. Please try again.'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-background px-6 py-20">
    <div className="mx-auto max-w-sm space-y-6">
      <ShieldCheck className="size-10 text-amber" />
      <h1 className="text-3xl font-semibold">Warranty Sentinel</h1>
      <p className="text-sm font-semibold text-amber">Kensington Big Machines Company</p>
      <h2 className="text-lg text-muted-foreground">Reviewer sign-in</h2>
      <div className="space-y-3">
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); void (async () => {
          setBusy(true); setError(''); setNotice('');
          try {
            const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
            if (authError) throw authError;
            setPassword('');
          } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in could not complete.'); }
          finally { setBusy(false); }
        })(); }}>
          <label className="block space-y-2 text-sm font-medium">Email ID<Input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label className="block space-y-2 text-sm font-medium">Password<Input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
          <Button type="submit" className="w-full" variant="navy" disabled={busy}>Sign in</Button>
        </form>
        <Button variant="link" disabled={busy} onClick={() => { void (async () => {
          setError(''); setNotice('');
          if (!email.trim()) { setError('Enter your email address first.'); return; }
          setBusy(true);
          try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
            if (resetError) throw resetError;
            setNotice('Check your email for a password reset link.');
          } catch (e) { setError(e instanceof Error ? e.message : 'Reset email could not be sent.'); }
          finally { setBusy(false); }
        })(); }}>Forgot password?</Button>
        <p className="text-center text-xs text-muted-foreground">Confidential — Kensington Big Machines Company · Powered by Marvin Bower &amp; Co</p>
        <Button className="w-full" variant="outline" disabled={busy} onClick={() => void signIn()}>Continue with Google</Button>
      </div>
      {notice && <p role="status" className="text-sm text-success">{notice}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button variant="link" onClick={() => void navigate({ to: '/' })}>Back to claims</Button>
    </div>
  </main>;
}