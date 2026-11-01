'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button } from '@/components/ui';
import { createClient } from '@/lib/supabase/client';

function safeNext(value: string | null): string {
  if (!value) return '/analytics';
  // Only allow same-origin absolute paths; never redirect to another site.
  if (!value.startsWith('/') || value.startsWith('//')) return '/analytics';
  return value;
}

export function LoginForm({ next }: { next: string | null }) {
  const router = useRouter();
  const target = safeNext(next);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let supabase;
    try {
      supabase = createClient();
    } catch {
      setError(
        'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then rebuild.'
      );
      setCheckingSession(false);
      return;
    }

    let disposed = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (disposed) return;
        if (data.session) {
          router.replace(target);
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => {
        if (!disposed) setCheckingSession(false);
      });

    return () => {
      disposed = true;
    };
  }, [router, target]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Enter your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        const message = signInError.message.toLowerCase();
        if (message.includes('invalid login credentials')) {
          setError('Email or password is incorrect.');
        } else if (message.includes('email not confirmed')) {
          setError('This account has not confirmed its email address. Contact your administrator.');
        } else if (message.includes('too many requests') || signInError.status === 429) {
          setError('Too many sign-in attempts. Wait a moment and try again.');
        } else {
          console.error('[auth] sign-in failed', signInError.status, signInError.message);
          setError('Could not sign in. Please try again.');
        }
        return;
      }

      setPassword('');
      setNotice('Signed in. Redirecting to analytics…');
      router.replace(target);
    } catch (caught) {
      console.error('[auth] sign-in failed', caught);
      setError('Could not reach the authentication service. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && (
        <Alert tone="error" title="Sign-in problem">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert tone="success" title="Signed in">
          {notice}
        </Alert>
      )}

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting || checkingSession}
          required
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
          Password
        </label>
        <div className="flex gap-2">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={submitting || checkingSession}
            required
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-gray-50"
          />
          <Button
            variant="secondary"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-pressed={showPassword}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            disabled={submitting}
          >
            {showPassword ? 'Hide' : 'Show'}
          </Button>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={submitting || checkingSession}>
        {checkingSession ? 'Checking session…' : submitting ? 'Signing in…' : 'Sign in'}
      </Button>

      <p className="text-center text-xs text-gray-500">
        Use the account issued by your school administrator. Access is limited to your school&apos;s
        published results.
      </p>
    </form>
  );
}
