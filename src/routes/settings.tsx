import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ArrowLeft, Settings, Save, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useReviewer } from '@/hooks/reviewer';
import { supabase } from '@/integrations/supabase/client';
import { profileSettingsSchema } from '@/lib/account-settings';

export const Route = createFileRoute('/settings')({
  head: () => ({ meta: [
    { title: 'Account Settings — Warranty Sentinel' },
    { name: 'description', content: 'Manage your Warranty Sentinel reviewer profile, email and password.' },
    { property: 'og:title', content: 'Account Settings — Warranty Sentinel' },
    { property: 'og:description', content: 'Warranty Sentinel reviewer account settings.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: AccountSettings,
});

function AccountSettings() {
  const { user, ready } = useReviewer();
  const queries = useQueryClient();
  const [profile, setProfile] = useState({ login_id: '', first_name: '', last_name: '' });
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const account = useQuery({ queryKey: ['account-settings', user?.id], enabled: Boolean(user), queryFn: async () => {
    if (!user) throw new Error('Sign in first.');
    const [p, r] = await Promise.all([
      supabase.from('profiles').select('login_id, first_name, last_name').eq('id', user.id).single(),
      supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
    ]);
    if (p.error) throw p.error;
    if (r.error) throw r.error;
    return { profile: p.data, role: r.data?.role };
  } });
  useEffect(() => {
    if (account.data) setProfile({ ...account.data.profile, login_id: account.data.profile.login_id ?? '' });
  }, [account.data]);
  useEffect(() => { setEmail(user?.email ?? ''); }, [user?.email]);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'The change could not be saved.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto min-h-screen max-w-4xl px-6 py-8">
    <Button asChild variant="ghost" className="mb-6"><Link to="/"><ArrowLeft />Claims workspace</Link></Button>
    <header className="border-b border-border pb-6"><p className="mb-2 text-sm font-semibold text-amber">Warranty Sentinel</p><h1 className="flex items-center gap-3 text-3xl font-semibold"><Settings />Account settings</h1></header>
    {!ready ? <p className="py-12 text-muted-foreground">Checking reviewer session…</p> : !user ? <div className="py-12"><Button asChild variant="navy"><Link to="/auth">Sign in to manage your account</Link></Button></div> : account.isPending ? <p className="py-12">Loading account…</p> : account.isError ? <div className="py-12" role="alert">Account could not load. <Button variant="outline" onClick={() => void account.refetch()}>Retry</Button></div> : <>
      {error && <p role="alert" className="mt-6 text-sm text-danger">{error}</p>}
      {notice && <p role="status" className="mt-6 text-sm text-success">{notice}</p>}
      <form className="space-y-5 border-b border-border py-8" onSubmit={e => { e.preventDefault(); void perform(async () => {
        const parsed = profileSettingsSchema.safeParse(profile);
        if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check your profile details.');
        const { error: saveError } = await supabase.from('profiles').update({ ...parsed.data, display_name: `${parsed.data.first_name} ${parsed.data.last_name}` }).eq('id', user.id);
        if (saveError) throw saveError;
        await queries.invalidateQueries({ queryKey: ['profile'] });
        await queries.invalidateQueries({ queryKey: ['account-settings'] });
        setNotice('Profile saved.');
      }); }}>
        <h2 className="text-xl font-semibold">Reviewer profile</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium">Login ID<Input required value={profile.login_id} maxLength={50} onChange={e => setProfile({ ...profile, login_id: e.target.value })} /></label>
          <label className="space-y-2 text-sm font-medium">Role<Input readOnly value={account.data?.role ?? 'Not assigned'} /></label>
          <label className="space-y-2 text-sm font-medium">First name<Input required value={profile.first_name} maxLength={100} onChange={e => setProfile({ ...profile, first_name: e.target.value })} /></label>
          <label className="space-y-2 text-sm font-medium">Last name<Input required value={profile.last_name} maxLength={100} onChange={e => setProfile({ ...profile, last_name: e.target.value })} /></label>
        </div>
        <Button variant="navy" disabled={busy} type="submit"><Save />Save profile</Button>
      </form>
      <form className="space-y-5 border-b border-border py-8" onSubmit={e => { e.preventDefault(); void perform(async () => {
        const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: window.location.origin });
        if (emailError) throw emailError;
        setNotice('Check your email to confirm the email address change.');
      }); }}>
        <h2 className="text-xl font-semibold">Email address</h2>
        <label className="block max-w-md space-y-2 text-sm font-medium">Email ID<Input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <Button variant="outline" disabled={busy || email === user.email} type="submit">Update email</Button>
      </form>
      <form className="space-y-5 py-8" onSubmit={e => { e.preventDefault(); void perform(async () => {
        if (password !== confirm) throw new Error('Passwords do not match.');
        const { error: passwordError } = await supabase.auth.updateUser({ password, current_password: currentPassword });
        if (passwordError) throw passwordError;
        setCurrentPassword(''); setPassword(''); setConfirm(''); setNotice('Password updated.');
      }); }}>
        <h2 className="text-xl font-semibold">Change password</h2>
        <div className="grid max-w-md gap-5">
          <label className="space-y-2 text-sm font-medium">Current password<Input type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>
          <label className="space-y-2 text-sm font-medium">New password<Input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} /></label>
          <label className="space-y-2 text-sm font-medium">Confirm new password<Input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
        </div>
        <Button variant="navy" disabled={busy} type="submit"><KeyRound />Update password</Button>
      </form>
    </>}
  </main>;
}