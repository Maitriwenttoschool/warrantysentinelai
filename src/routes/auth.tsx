import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { lovable } from '@/integrations/lovable';
import { useReviewer } from '@/hooks/reviewer';
import '@lovable.dev/cloud-auth-js/styles.css';

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
      <h2 className="text-lg text-muted-foreground">Reviewer sign-in</h2>
      <div className="space-y-3">
        <Button className="w-full" variant="outline" disabled={busy} onClick={() => void signIn()}>Continue with Google</Button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button variant="link" onClick={() => void navigate({ to: '/' })}>Back to claims</Button>
    </div>
  </main>;
}