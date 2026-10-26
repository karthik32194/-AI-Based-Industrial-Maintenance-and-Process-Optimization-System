"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Email validation regex
  const isValidEmail = (val: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your work email address.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid work email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const message =
          typeof data?.detail === "string"
            ? data.detail
            : "Invalid email or password.";
        throw new Error(message);
      }

      if (!data?.access_token) {
        throw new Error("Login succeeded, but no access token was returned.");
      }

      localStorage.removeItem("access_token");
      localStorage.removeItem("user");

      localStorage.setItem("access_token", data.access_token);

      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
      }

      setSuccess(true);
      setTimeout(() => {
        router.replace("/");
      }, 500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the authentication service."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleOAuthLogin(provider: "google" | "microsoft" | "github" | "sso") {
    setError("");
    // Redirect to OAuth or SSO endpoint if applicable:
    // window.location.href = `${API_URL}/api/auth/oauth/${provider}`;
    console.log(`Authenticating with: ${provider}`);
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-between overflow-x-hidden bg-[#07060e] px-4 py-8 text-zinc-100 antialiased selection:bg-purple-500/30 selection:text-purple-200 sm:px-6 sm:py-12">
      
      {/* Ambient Lighting — Subtle Top Purple & Blue Ambient Gradients */}
      <div 
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 70% 55% at 50% -10%, rgba(147, 51, 234, 0.15) 0%, transparent 75%),
            radial-gradient(ellipse 55% 40% at 50% 110%, rgba(37, 99, 235, 0.08) 0%, transparent 75%)
          `,
        }}
      />

      {/* Subtle Industrial / Technology Grid Pattern with Vignette */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.25) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.25) 1px, transparent 1px)
          `,
          backgroundSize: "36px 36px",
          maskImage: "radial-gradient(ellipse 70% 65% at 50% 45%, black 25%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 65% at 50% 45%, black 25%, transparent 85%)",
        }}
      />

      {/* Abstract Industrial Micro-circuit Texture (Barely Visible) */}
      <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="industrial-circuit" width="140" height="140" patternUnits="userSpaceOnUse">
            <path d="M0 70h35l15-15h40l15 15h35M70 0v35l-15 15v40l15 15v35" fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3"/>
            <circle cx="70" cy="70" r="2.5" fill="currentColor"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#industrial-circuit)" className="text-purple-300" />
      </svg>

      {/* Top spacer for vertical balancing */}
      <div className="w-full shrink-0" />

      {/* Central Auth Container */}
      <div className="relative z-10 my-auto w-full max-w-[420px]">
        
        {/* Brand Header */}
        <header className="mb-6 text-center">
          {/* Brand Identity Eyebrow */}
          <div className="inline-flex items-center justify-center gap-2.5">
            <span className="h-px w-6 bg-gradient-to-r from-transparent to-purple-400/50" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-purple-300/90">
              Industrial Intelligence
            </span>
            <span className="h-px w-6 bg-gradient-to-l from-transparent to-purple-400/50" />
          </div>

          {/* Welcome back (Enlarged to 44–46px on desktop) */}
          <h1 className="mt-2.5 text-3xl font-bold tracking-tight text-white sm:text-[44px] sm:leading-[1.15] md:text-[46px]">
            Welcome back
          </h1>
          <p className="mt-2 text-xs text-zinc-400/90 sm:text-[13px]">
            Sign in to access your maintenance &amp; telemetry dashboard
          </p>
        </header>

        {/* Login Card */}
        <div className="relative rounded-2xl border border-white/[0.08] bg-[#0d0c17]/85 p-6 pb-8 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:p-8 sm:pb-9">
          
          {/* Card Top Edge Hairline Specular Highlight */}
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />

          {/* Direct Credentials Form */}
          <form onSubmit={handleLogin} noValidate className="space-y-4">
            
            {/* Work Email Field */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-[13px] font-semibold text-zinc-200 sm:text-sm"
              >
                Work email
              </label>

              <div className="relative flex h-11 items-center rounded-xl border border-white/[0.08] bg-[#080710] transition-all duration-200 focus-within:border-purple-500/70 focus-within:bg-[#0c0a18] focus-within:ring-2 focus-within:ring-purple-500/20 sm:h-12">
                <div className="pointer-events-none flex pl-3.5 text-zinc-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="name@company.com"
                  autoComplete="email"
                  disabled={loading || success}
                  required
                  aria-invalid={!!error}
                  className="w-full bg-transparent px-3 text-sm text-zinc-100 placeholder-zinc-400/75 outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-[15px]"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-[13px] font-semibold text-zinc-200 sm:text-sm"
                >
                  Password
                </label>
                <a
                  href="#forgot-password"
                  className="text-xs font-medium text-purple-400 transition-colors hover:text-purple-300 focus-visible:outline-none focus-visible:underline"
                >
                  Forgot password?
                </a>
              </div>

              <div className="relative flex h-11 items-center rounded-xl border border-white/[0.08] bg-[#080710] transition-all duration-200 focus-within:border-purple-500/70 focus-within:bg-[#0c0a18] focus-within:ring-2 focus-within:ring-purple-500/20 sm:h-12">
                <div className="pointer-events-none flex pl-3.5 text-zinc-500">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError("");
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading || success}
                  required
                  aria-invalid={!!error}
                  className="w-full bg-transparent px-3 text-sm text-zinc-100 placeholder-zinc-400/75 outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-[15px]"
                />

                {/* Show/Hide Password Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="mr-2.5 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember This Device (Larger 18px checkbox & clearer typography) */}
            <div className="flex items-center pt-0.5">
              <label 
                onClick={() => setRememberMe(!rememberMe)}
                className="group flex cursor-pointer select-none items-center gap-2.5"
              >
                <div
                  role="checkbox"
                  aria-checked={rememberMe}
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-all duration-150 ${
                    rememberMe
                      ? "border-purple-500 bg-purple-600 text-white shadow-sm shadow-purple-500/30"
                      : "border-white/20 bg-white/[0.03] group-hover:border-white/40"
                  }`}
                >
                  {rememberMe && (
                    <svg className="h-3 w-3 stroke-current" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6L4.5 8.5L10 3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-[13px] font-medium text-zinc-300 transition-colors group-hover:text-white sm:text-sm">
                  Remember this device
                </span>
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="flex items-center gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-3.5 py-2.5 text-xs text-rose-300"
              >
                <svg className="h-4 w-4 shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Main Primary Button (Purple-to-Blue Gradient with Arrow) */}
            <button
              type="submit"
              disabled={loading || success}
              className={`group relative flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white shadow-lg transition-all duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:h-12 ${
                success
                  ? "bg-emerald-600 shadow-emerald-500/25"
                  : "bg-gradient-to-r from-[#8b5cf6] via-[#6366f1] to-[#2563eb] shadow-[0_4px_22px_rgba(99,102,241,0.28)] hover:shadow-[0_6px_28px_rgba(99,102,241,0.4)] hover:brightness-105"
              }`}
            >
              {/* Inner Bevel Specular Shine */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-xl bg-white/25" />

              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Signing in...</span>
                </>
              ) : success ? (
                <>
                  <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Authenticated. Redirecting...</span>
                </>
              ) : (
                <>
                  <span>Sign in to dashboard</span>
                  <svg className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Elegant "or continue with" Divider */}
          <div className="relative my-5 flex items-center justify-center">
            <div className="w-full border-t border-white/[0.08]" />
            <span className="absolute bg-[#0d0c17] px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              or continue with
            </span>
          </div>

          {/* Social Authentication: Google, Microsoft, GitHub */}
          <div className="grid grid-cols-3 gap-2">
            
            {/* Google */}
            <button
              type="button"
              onClick={() => handleOAuthLogin("google")}
              disabled={loading || success}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-xs font-medium text-zinc-300 transition-all duration-150 hover:border-white/20 hover:bg-white/[0.05] hover:text-white active:scale-[0.98] disabled:opacity-50"
              title="Continue with Google"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.54 0 2.93.53 4.02 1.57l3.01-3.01C17.21 1.84 14.8 1 12 1 7.37 1 3.42 3.65 1.5 7.46l3.66 2.84C6.04 7.34 8.78 5 12 5z"/>
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.7 2.87c2.16-1.99 3.72-4.93 3.72-8.69z"/>
                <path fill="#FBBC05" d="M5.16 14.7c-.23-.69-.36-1.43-.36-2.2s.13-1.51.36-2.2L1.5 7.46C.55 9.35 0 11.61 0 14s.55 4.65 1.5 6.54l3.66-2.84z"/>
                <path fill="#34A853" d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.7-2.87c-1.08.72-2.45 1.16-4.23 1.16-3.22 0-5.96-2.34-6.84-5.3L1.5 16.54C3.42 20.35 7.37 23 12 23z"/>
              </svg>
              <span>Google</span>
            </button>

            {/* Microsoft */}
            <button
              type="button"
              onClick={() => handleOAuthLogin("microsoft")}
              disabled={loading || success}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-xs font-medium text-zinc-300 transition-all duration-150 hover:border-white/20 hover:bg-white/[0.05] hover:text-white active:scale-[0.98] disabled:opacity-50"
              title="Continue with Microsoft"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              <span>Microsoft</span>
            </button>

            {/* GitHub */}
            <button
              type="button"
              onClick={() => handleOAuthLogin("github")}
              disabled={loading || success}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] text-xs font-medium text-zinc-300 transition-all duration-150 hover:border-white/20 hover:bg-white/[0.05] hover:text-white active:scale-[0.98] disabled:opacity-50"
              title="Continue with GitHub"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </button>
          </div>

          {/* Emphasized Enterprise SSO Section */}
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => handleOAuthLogin("sso")}
              disabled={loading || success}
              className="group relative flex h-10 w-full items-center justify-between rounded-xl border border-purple-500/25 bg-gradient-to-r from-purple-500/[0.07] to-indigo-500/[0.07] px-3.5 text-xs font-medium text-purple-200 transition-all duration-150 hover:border-purple-400/50 hover:bg-purple-500/[0.12] hover:text-white active:scale-[0.99] disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 text-purple-400 group-hover:text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="font-semibold">Enterprise Single Sign-On</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-purple-300/70 group-hover:text-purple-200">
                SAML / Okta →
              </span>
            </button>
          </div>

          {/* Subtle Security Badge */}
          <div className="mt-6 border-t border-white/[0.06] pt-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-zinc-300">
              <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Secure enterprise access</span>
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Your connection is encrypted and your data is protected.
            </p>
          </div>

        </div>

      </div>

      {/* Enterprise Footer */}
      <footer className="w-full max-w-sm shrink-0 pt-6 text-center text-[11px] text-zinc-500">
        <div className="flex items-center justify-center gap-3">
          <a href="#help" className="text-purple-400 transition-colors hover:text-purple-300">Need help?</a>
          <span>•</span>
          <a href="#privacy" className="transition-colors hover:text-zinc-400">Privacy Policy</a>
          <span>•</span>
          <a href="#terms" className="transition-colors hover:text-zinc-400">Terms of Service</a>
        </div>
        <p className="mt-2 text-zinc-600">
          © {new Date().getFullYear()} Industrial Intelligence Inc. All rights reserved.
        </p>
      </footer>

    </main>
  );
}

