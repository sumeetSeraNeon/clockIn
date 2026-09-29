'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert } from '@/components/common/Alert';
import { BrandMark } from '@/components/common/BrandMark';
import { FormField } from '@/components/common/FormField';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/cn';

type Mode = 'login' | 'reset' | 'request';

const DEFAULT_ORG_CODE =
  process.env.NEXT_PUBLIC_ORG_CODE?.trim().toUpperCase() || 'CLK';

export default function LoginPage() {
  const {
    status,
    login,
    error,
    notice,
    clearNotice,
    requestPasswordReset,
    requestAccess,
  } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [orgCode, setOrgCode] = useState(DEFAULT_ORG_CODE);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [requestSent, setRequestSent] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [status, router]);

  function switchMode(next: Mode) {
    setMode(next);
    setLocalError(null);
    setResetSent(false);
    setRequestSent(null);
    if (next !== 'login') clearNotice();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    clearNotice();
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        router.replace('/dashboard');
      } else if (mode === 'reset') {
        await requestPasswordReset(email);
        setResetSent(true);
      } else {
        const result = await requestAccess({
          email,
          password,
          name,
          organisationCode: orgCode,
        });
        setRequestSent(result.message);
        setPassword('');
      }
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : mode === 'login'
            ? 'Login failed'
            : mode === 'reset'
              ? 'Could not send reset email'
              : 'Could not submit access request',
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (status === 'loading' && !submitting) {
    return <LoadingScreen message="Checking your session…" />;
  }

  if (status === 'authenticated') {
    return <LoadingScreen message="Opening Sera Neon…" />;
  }

  const displayError = localError || error;
  const isLogin = mode === 'login';
  const isReset = mode === 'reset';
  const isRequest = mode === 'request';

  return (
    <main className="flex h-full overflow-y-auto overscroll-none bg-paper">
      <section className="relative hidden w-[42%] flex-col justify-between bg-navy px-12 py-14 text-white lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <BrandMark size={44} priority />
            <div>
              <p className="text-lg font-semibold tracking-tight">Sera Neon</p>
              <p className="text-sm text-white/50">ClockIn</p>
            </div>
          </div>

          <h1 className="mt-20 max-w-[16ch] text-[2.5rem] font-semibold leading-[1.15] tracking-tight">
            Time that stays clear and billable.
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/60">
            Track delivery across clients, projects, and your team — with invite-only
            access for your organisation.
          </p>
        </div>

        <p className="text-xs text-white/40">Internal tool · Invite only</p>
      </section>

      <section className="flex flex-1 items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 lg:hidden">
            <div className="flex items-center gap-2.5">
              <BrandMark size={40} />
              <div>
                <p className="text-base font-semibold text-ink">Sera Neon</p>
                <p className="text-xs text-slate">ClockIn</p>
              </div>
            </div>
          </div>

          <div className="relative min-h-[6.5rem]">
            <div
              className={cn(
                'transition-all duration-300 ease-out',
                isLogin
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none absolute inset-x-0 -translate-y-1 opacity-0',
              )}
              aria-hidden={!isLogin}
            >
              <p className="text-sm font-medium text-coral">Welcome back</p>
              <h2 className="mt-2 text-[1.75rem] font-semibold tracking-tight text-ink">
                Sign in to ClockIn
              </h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-slate">
                Use an approved account. New people can request access — an admin
                must approve before you can sign in.
              </p>
            </div>

            <div
              className={cn(
                'transition-all duration-300 ease-out',
                isReset
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none absolute inset-x-0 translate-y-1 opacity-0',
              )}
              aria-hidden={!isReset}
            >
              <p className="text-sm font-medium text-coral">Account recovery</p>
              <h2 className="mt-2 text-[1.75rem] font-semibold tracking-tight text-ink">
                Reset your password
              </h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-slate">
                Enter your email and we will send a reset link if the account
                exists.
              </p>
            </div>

            <div
              className={cn(
                'transition-all duration-300 ease-out',
                isRequest
                  ? 'translate-y-0 opacity-100'
                  : 'pointer-events-none absolute inset-x-0 translate-y-1 opacity-0',
              )}
              aria-hidden={!isRequest}
            >
              <p className="text-sm font-medium text-coral">Invite only</p>
              <h2 className="mt-2 text-[1.75rem] font-semibold tracking-tight text-ink">
                Request access
              </h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-slate">
                Create your login, then wait for an admin to approve your
                membership.
              </p>
            </div>
          </div>

          <div className="mt-7 space-y-3">
            {notice === 'session_expired' ? (
              <Alert variant="warning">
                Your session expired. Please sign in again.
              </Alert>
            ) : null}

            {resetSent ? (
              <Alert variant="success">
                If an account exists for that email, a reset link is on its way.
              </Alert>
            ) : null}

            {requestSent ? (
              <Alert variant="success">{requestSent}</Alert>
            ) : null}

            {displayError ? (
              <Alert variant="error">{displayError}</Alert>
            ) : null}
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-5">
            {isRequest ? (
              <>
                <FormField label="Full name" htmlFor="name">
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    required
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11"
                  />
                </FormField>
                <FormField
                  label="Organisation code"
                  htmlFor="orgCode"
                  hint="Ask your admin (seed default: CLK)"
                >
                  <Input
                    id="orgCode"
                    type="text"
                    required
                    placeholder="CLK"
                    value={orgCode}
                    onChange={(e) => setOrgCode(e.target.value.toUpperCase())}
                    className="h-11"
                  />
                </FormField>
              </>
            ) : null}

            <FormField label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                invalid={Boolean(displayError)}
                className="h-11"
              />
            </FormField>

            <div
              className={cn(
                'grid transition-[grid-template-rows] duration-300 ease-out',
                isLogin || isRequest ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <FormField label="Password" htmlFor="password" className="pb-0">
                  <Input
                    id="password"
                    type="password"
                    autoComplete={
                      isRequest ? 'new-password' : 'current-password'
                    }
                    required={isLogin || isRequest}
                    minLength={isRequest ? 6 : undefined}
                    tabIndex={isLogin || isRequest ? 0 : -1}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    invalid={Boolean(displayError) && (isLogin || isRequest)}
                    className="h-11"
                  />
                </FormField>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              {isLogin ? (
                <>
                  <button
                    type="button"
                    className="text-sm font-medium text-slate transition-colors duration-200 hover:text-ink"
                    onClick={() => switchMode('request')}
                  >
                    Request access
                  </button>
                  <button
                    type="button"
                    className="text-sm font-medium text-slate transition-colors duration-200 hover:text-ink"
                    onClick={() => switchMode('reset')}
                  >
                    Forgot password?
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="text-sm font-medium text-slate transition-colors duration-200 hover:text-ink"
                  onClick={() => switchMode('login')}
                >
                  Back to sign in
                </button>
              )}
            </div>

            <Button
              type="submit"
              className="h-11 w-full rounded-xl text-[15px]"
              loading={submitting}
              disabled={submitting || Boolean(requestSent && isRequest)}
            >
              {isLogin
                ? 'Sign in'
                : isReset
                  ? 'Send reset link'
                  : 'Submit request'}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
