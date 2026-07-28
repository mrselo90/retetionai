'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import { Link as I18nLink } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useTranslations } from 'next-intl';

export default function LoginPage() {
  const t = useTranslations('Login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | React.ReactNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const shop = searchParams.get('shop');
    const host = searchParams.get('host');
    const embedded = searchParams.get('embedded');
    const idToken = searchParams.get('id_token');
    const looksLikeShopifyEntry =
      !!shop || !!host || embedded === '1' || Boolean(idToken);

    if (!looksLikeShopifyEntry || typeof window === 'undefined') return;

    const shellBase =
      process.env.NEXT_PUBLIC_SHOPIFY_SHELL_URL || 'https://shop.recete.co.uk';
    const target = new URL('/auth/login', shellBase);

    searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    window.location.replace(target.toString());
  }, [searchParams]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (oauthError) {
        const msg = oauthError.message ?? '';
        if (msg.includes('provider is not enabled') || msg.includes('Unsupported provider')) {
          setError(t('errors.googleDisabled'));
        } else {
          setError(oauthError.message);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('provider is not enabled') || msg.includes('Unsupported provider')) {
        setError(t('errors.googleDisabled'));
      } else {
        setError(msg || t('errors.default'));
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        const msg = (authError.message ?? '').toLowerCase();
        const isEmailNotConfirmed =
          msg.includes('email not confirmed') ||
          msg.includes('email_not_confirmed') ||
          msg.includes('not confirmed');

        if (isEmailNotConfirmed) {
          setError(
            <span>
              {t('errors.emailNotConfirmed')}{' '}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const { error: resendError } = await supabase.auth.resend({
                      type: 'signup',
                      email: email,
                    });
                    if (resendError) {
                      setError(resendError.message);
                    } else {
                      setError(t('errors.resendSuccess'));
                    }
                  } catch {
                    setError(t('errors.resendError'));
                  }
                }}
                style={{ textDecoration: 'underline', fontWeight: 500 }}
              >
                {t('errors.resendVerification')}
              </button>
            </span>
          );
          return;
        }

        setError(authError.message || t('errors.invalidCredentials'));
        return;
      }

      if (data.session) {
        router.push('/dashboard');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes('email not confirmed') || message.toLowerCase().includes('not confirmed')) {
        setError(
          <span>
            {t('errors.emailNotConfirmed')}{' '}
            <button
              type="button"
              onClick={async () => {
                try {
                  const { error: resendError } = await supabase.auth.resend({
                    type: 'signup',
                    email: email,
                  });
                  if (resendError) {
                    setError(resendError.message);
                  } else {
                    setError(t('errors.resendSuccess'));
                  }
                } catch {
                  setError(t('errors.resendError'));
                }
              }}
              style={{ textDecoration: 'underline', fontWeight: 500 }}
            >
              {t('errors.resendVerification')}
            </button>
          </span>
        );
      } else {
        setError(message || t('errors.default'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing" style={{ minHeight: '100vh', display: 'flex' }}>
      {/* ── Left panel — branding ── */}
      <div style={{
        display: 'none',
        width: '45%',
        flexShrink: 0,
        background: 'var(--link)',
        color: 'var(--lbg)',
        padding: '48px 52px',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }} className="lauth-left">
        {/* Logo */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="lnav-logo-mark">R</div>
            <span style={{
              fontFamily: "'Playfair Display', 'Georgia', serif",
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--lbg)',
            }}>recete</span>
          </div>
        </div>

        {/* Middle — tagline */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32, paddingTop: 64, paddingBottom: 48 }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: 0.5,
              marginBottom: 16,
            }}>Post-purchase AI · WhatsApp</div>
            <h2 style={{
              fontSize: 'clamp(28px, 3vw, 40px)',
              fontWeight: 500,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              margin: 0,
              color: 'var(--lbg)',
            }}>
              Turn every order into<br />
              <span style={{ opacity: 0.55 }}>a loyal customer.</span>
            </h2>
          </div>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              'AI that replies on WhatsApp — in your brand voice',
              'Reduce returns before customers ask for them',
              'Reorder reminders that actually convert',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  background: 'oklch(0.42 0.07 160)',
                  flexShrink: 0,
                  marginTop: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span style={{ fontSize: 14, lineHeight: 1.45, opacity: 0.8 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div style={{
          borderTop: '1px solid',
          borderColor: 'rgba(255,255,255,0.12)',
          paddingTop: 28,
        }}>
          <p style={{ fontSize: 14, lineHeight: 1.55, opacity: 0.65, margin: '0 0 16px', fontStyle: 'italic' }}>
            &ldquo;We reduced avoidable returns by 28% in the first month. Setup took one afternoon.&rdquo;
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'oklch(0.42 0.07 160)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 600,
              color: 'white',
            }}>E</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Ece Demir</div>
              <div style={{ fontSize: 12, opacity: 0.5 }}>Founder · skincare brand</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div style={{
        flex: 1,
        background: 'var(--lbg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        minHeight: '100vh',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Mobile logo (only shown when left panel is hidden) */}
          <div className="lauth-mobile-logo" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40, justifyContent: 'center' }}>
            <div className="lnav-logo-mark">R</div>
            <span style={{
              fontFamily: "'Playfair Display', 'Georgia', serif",
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--link)',
            }}>recete</span>
          </div>

          {/* Heading */}
          <div style={{ marginBottom: 32 }}>
            <h1 style={{
              fontSize: 26,
              fontWeight: 500,
              letterSpacing: '-0.025em',
              color: 'var(--link)',
              margin: '0 0 6px',
            }}>Welcome back</h1>
            <p style={{ fontSize: 14, color: 'var(--link-3)', margin: 0 }}>
              Sign in to your Recete account
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px',
              background: 'oklch(0.96 0.02 20)',
              border: '1px solid oklch(0.88 0.05 20)',
              borderRadius: 10,
              marginBottom: 20,
              fontSize: 13.5,
              color: 'oklch(0.35 0.08 20)',
              lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--link-2)' }} htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={{
                  height: 44,
                  padding: '0 14px',
                  border: '1px solid var(--lline-2)',
                  borderRadius: 10,
                  background: 'var(--lbg)',
                  color: 'var(--link)',
                  fontSize: 14,
                  outline: 'none',
                  transition: 'border-color 140ms',
                  fontFamily: 'inherit',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--link)'; e.target.style.boxShadow = '0 0 0 3px oklch(0.42 0.07 160 / 0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--lline-2)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--link-2)' }} htmlFor="password">
                  Password
                </label>
                <I18nLink href="/forgot-password" style={{
                  fontSize: 13,
                  color: 'var(--laccent-ink)',
                  textDecoration: 'none',
                }}>
                  Forgot password?
                </I18nLink>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  height: 44,
                  padding: '0 14px',
                  border: '1px solid var(--lline-2)',
                  borderRadius: 10,
                  background: 'var(--lbg)',
                  color: 'var(--link)',
                  fontSize: 14,
                  outline: 'none',
                  transition: 'border-color 140ms',
                  fontFamily: 'inherit',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--link)'; e.target.style.boxShadow = '0 0 0 3px oklch(0.42 0.07 160 / 0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--lline-2)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="lbtn lbtn-primary"
              style={{
                width: '100%',
                height: 44,
                fontSize: 14,
                fontWeight: 500,
                marginTop: 4,
                justifyContent: 'center',
                gap: 8,
                opacity: loading ? 0.65 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round"/>
                  </svg>
                  Signing in…
                </>
              ) : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--lline)' }} />
            <span style={{ fontSize: 12, color: 'var(--link-4)', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.04em' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: 'var(--lline)' }} />
          </div>

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="lbtn lbtn-outline"
            style={{
              width: '100%',
              height: 44,
              fontSize: 14,
              fontWeight: 500,
              justifyContent: 'center',
              gap: 10,
              opacity: (googleLoading || loading) ? 0.65 : 1,
              cursor: (googleLoading || loading) ? 'not-allowed' : 'pointer',
            }}
          >
            {googleLoading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          {/* Footer */}
          <p style={{ textAlign: 'center', fontSize: 13.5, color: 'var(--link-3)', marginTop: 28 }}>
            Don&apos;t have an account?{' '}
            <I18nLink href="/signup" style={{ color: 'var(--laccent-ink)', fontWeight: 500, textDecoration: 'none' }}>
              Sign up free
            </I18nLink>
          </p>

          {/* Back to site */}
          <div style={{ textAlign: 'center', marginTop: 40 }}>
            <I18nLink href="/" style={{ fontSize: 12, color: 'var(--link-4)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
                <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="scale(-1,1) translate(-20,0)"/>
              </svg>
              Back to recete.co.uk
            </I18nLink>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        /* Show left panel on desktop */
        @media (min-width: 768px) {
          .lauth-left { display: flex !important; }
          .lauth-mobile-logo { display: none !important; }
        }
      `}</style>
    </div>
  );
}
