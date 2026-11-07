"use client";

import {
  Eye,
  EyeOff,
  ArrowRight,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { GoogleOAuthProvider, useGoogleLogin } from "@react-oauth/google";
import {
  getAccessToken,
  getRememberPreference,
  loginRequest,
  googleLoginRequest,
  persistSession,
  registerRequest,
} from "@/lib/auth-api";
import { SplashScreen } from "./SplashScreen";

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  "743020408271-ge3g4tooe22eb2m83vsek8iuvfedjhrj.apps.googleusercontent.com";

type Mode = "login" | "register";

function LoginFormContent() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [rememberReady, setRememberReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    setRemember(getRememberPreference());
    setRememberReady(true);
  }, []);

  useEffect(() => {
    if (!rememberReady) return;
    if (getAccessToken()) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem("cupomhub_just_logged_in", "1");
      }
      router.replace("/notasfiscais");
      return;
    }
    setCheckingSession(false);
  }, [router, rememberReady]);

  // Google GIS Prompt Native
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!document.getElementById("google-gsi-script")) {
      const script = document.createElement("script");
      script.id = "google-gsi-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleGoogleSuccess = async (tokenOrCredential: string) => {
    setError(null);
    setLoading(true);
    try {
      const data = await googleLoginRequest(tokenOrCredential, remember);
      persistSession(data, remember);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("cupomhub_just_logged_in", "1");
      }
      router.push("/notasfiscais");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar com Google");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        await res.json();
        if (tokenResponse.access_token) {
          await handleGoogleSuccess(tokenResponse.access_token);
        }
      } catch {
        setError("Falha ao obter perfil do Google");
      }
    },
    onError: () => {
      setError("Login com Google cancelado ou falhou");
    },
  });

  const toggleMode = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError(null);
  };

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await loginRequest(username.trim(), password, remember);
      persistSession(data, remember);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("cupomhub_just_logged_in", "1");
      }
      router.push("/notasfiscais");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanEmail = username.trim().toLowerCase();
    if (!cleanEmail.includes("@") || !/^[^s@]+@[^s@]+\.[^s@]+$/.test(cleanEmail)) {
      setError("Por favor, informe um endereço de e-mail válido");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem");
      return;
    }
    setLoading(true);
    try {
      await registerRequest(cleanEmail, password);
      const data = await loginRequest(cleanEmail, password, remember);
      persistSession(data, remember);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("cupomhub_just_logged_in", "1");
      }
      router.push("/notasfiscais");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  const isLogin = mode === "login";

  if (checkingSession) {
    return <SplashScreen />;
  }

  return (
    <main className="login-page-body font-sans antialiased selection:bg-emerald-500 selection:text-white">
      <div className="login-container p-4 sm:p-6 lg:p-8">
        {/* Card de Login Centralizado com Dark Glassmorphism conforme mockup */}
        <div className="relative z-10 w-full max-w-[390px] sm:max-w-[420px] mx-auto rounded-3xl bg-[#071626]/95 backdrop-blur-2xl border border-sky-800/40 p-6 sm:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] my-auto transition-all duration-300">
          
          {/* ── 1. Top Header: Logo CupomHub com Brilho Neon ── */}
          <div className="flex items-center justify-center gap-3.5 mb-7">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-green-600 text-white shadow-[0_0_30px_rgba(16,185,129,0.45)] border border-emerald-300/35">
              <ShoppingCart className="h-7 w-7 text-white stroke-[2.2]" />
            </div>
            <div className="text-left">
              <span className="text-2xl font-black text-white tracking-tight block leading-tight">
                CupomHub
              </span>
              <span className="text-xs font-medium text-emerald-300/80 block mt-0.5">
                Gestão de Compras & Preços
              </span>
            </div>
          </div>

          {/* ── 2. Mensagem de Boas-Vindas ── */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-[280px] sm:max-w-xs mx-auto leading-relaxed">
              {isLogin
                ? "Acesse sua conta para gerenciar seus cupons e listas."
                : "Cadastre-se com seu e-mail para começar a economizar."}
            </p>
          </div>

          {/* ── 3. Formulário de Login / Cadastro ── */}
          <form onSubmit={isLogin ? onLogin : onRegister} className="space-y-4">
            {/* Campo E-mail ou Usuário */}
            <div className="space-y-1.5 text-left">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider pl-1">
                {isLogin ? "E-mail ou Usuário" : "E-mail"}
              </label>
              <div className="relative rounded-2xl border border-sky-900/50 bg-[#091b30]/80 shadow-inner backdrop-blur-md transition-all duration-200 focus-within:border-sky-500/80 focus-within:bg-[#0c223c] focus-within:ring-2 focus-within:ring-sky-500/20">
                <input
                  type={isLogin ? "text" : "email"}
                  required
                  placeholder={
                    isLogin
                      ? "seu.email@exemplo.com ou usuário"
                      : "seu.email@exemplo.com"
                  }
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full px-4 py-3.5 text-sm font-medium text-white placeholder:text-slate-500 bg-transparent rounded-2xl focus:outline-none"
                />
              </div>
            </div>

            {/* Campo Senha */}
            <div className="space-y-1.5 text-left">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider pl-1">
                Senha
              </label>
              <div className="relative rounded-2xl border border-sky-900/50 bg-[#091b30]/80 shadow-inner backdrop-blur-md transition-all duration-200 focus-within:border-sky-500/80 focus-within:bg-[#0c223c] focus-within:ring-2 focus-within:ring-sky-500/20">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-4 pr-12 py-3.5 text-sm font-medium text-white placeholder:text-slate-500 bg-transparent rounded-2xl focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  title={showPassword ? "Ocultar senha" : "Ver senha"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Campo Confirmar Senha (apenas no Cadastro) */}
            {!isLogin && (
              <div className="space-y-1.5 text-left animate-fadeIn">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider pl-1">
                  Confirmar Senha
                </label>
                <div className="relative rounded-2xl border border-sky-900/50 bg-[#091b30]/80 shadow-inner backdrop-blur-md transition-all duration-200 focus-within:border-sky-500/80 focus-within:bg-[#0c223c] focus-within:ring-2 focus-within:ring-sky-500/20">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full pl-4 pr-12 py-3.5 text-sm font-medium text-white placeholder:text-slate-500 bg-transparent rounded-2xl focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* ── 4. Linha "Lembrar de mim" (Componente Padrão de Toggle Switch) & "Esqueceu a senha?" ── */}
            {isLogin && (
              <div className="flex items-center justify-between text-xs pt-1 pb-1">
                <div className="flex items-center gap-2.5 select-none">
                  {/* Toggle switch padrão e responsivo */}
                  <button
                    type="button"
                    role="switch"
                    id="remember-me"
                    aria-checked={remember}
                    onClick={() => setRemember((prev) => !prev)}
                    className={`relative inline-flex h-5 w-9 sm:h-6 sm:w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                      remember ? "bg-emerald-500" : "bg-slate-700"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        remember ? "translate-x-4 sm:translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <label
                    htmlFor="remember-me"
                    onClick={() => setRemember((prev) => !prev)}
                    className="text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer select-none"
                  >
                    Lembrar de mim
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setError(
                      "Para recuperar o acesso, faça login com o Google ou solicite nova senha ao administrador."
                    )
                  }
                  className="text-xs font-medium text-sky-400 hover:text-sky-300 hover:underline transition-colors cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
            )}

            {/* Mensagem de Erro */}
            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-950/40 p-3 text-center text-xs font-medium text-red-300 animate-fadeIn backdrop-blur-sm">
                {error}
              </div>
            )}

            {/* ── 5. Botão Primário Verde com Gradiente e Glow ── */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 h-12 sm:h-13 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 text-white font-bold text-sm sm:text-base shadow-[0_8px_30px_rgba(22,163,74,0.4)] hover:shadow-[0_8px_35px_rgba(22,163,74,0.6)] hover:brightness-110 active:scale-[0.99] transition-all duration-200 disabled:opacity-60 cursor-pointer"
              >
                <span>
                  {loading
                    ? "Autenticando..."
                    : isLogin
                    ? "Entrar na Conta"
                    : "Criar Conta"}
                </span>
                <ArrowRight className="h-4 w-4 stroke-[2.5]" />
              </button>
            </div>
          </form>

          {/* ── 6. Divisor OU ENTRE COM ── */}
          <div className="relative my-6 flex items-center justify-center">
            <div className="w-full h-px bg-slate-800/80" />
            <span className="absolute bg-[#071626] px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              OU ENTRE COM
            </span>
          </div>

          {/* ── 7. Três Botões Sociais Redondos com Glow Halo ── */}
          <div className="flex items-center justify-center gap-4">
            {/* Botão Google */}
            <button
              type="button"
              onClick={() => handleGoogleLogin()}
              disabled={loading}
              className="group relative flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-[#0d223a] border border-[#1e3c63]/70 hover:border-sky-400/80 hover:bg-[#122c4a] transition-all shadow-[0_0_20px_rgba(66,133,244,0.25)] hover:shadow-[0_0_25px_rgba(66,133,244,0.45)] hover:scale-105 active:scale-95 cursor-pointer"
              title="Entrar com Google"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </button>

            {/* Botão Apple */}
            <button
              type="button"
              onClick={() =>
                setError(
                  "Login com Apple estará disponível em breve! Por favor, utilize o Google ou e-mail/senha."
                )
              }
              className="group relative flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-[#0d223a] border border-[#1e3c63]/70 hover:border-white/50 hover:bg-[#122c4a] transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_25px_rgba(255,255,255,0.3)] hover:scale-105 active:scale-95 cursor-pointer"
              title="Entrar com Apple"
            >
              <svg className="h-5 w-5 fill-white" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.87c.65-.79 1.09-1.89.97-2.99-.95.04-2.1.63-2.77 1.42-.59.68-1.11 1.79-.97 2.86 1.06.08 2.13-.53 2.77-1.29" />
              </svg>
            </button>

            {/* Botão GitHub */}
            <button
              type="button"
              onClick={() =>
                setError(
                  "Login com GitHub estará disponível em breve! Por favor, utilize o Google ou e-mail/senha."
                )
              }
              className="group relative flex h-12 w-12 sm:h-13 sm:w-13 items-center justify-center rounded-full bg-[#0d223a] border border-[#1e3c63]/70 hover:border-emerald-400/80 hover:bg-[#122c4a] transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_25px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95 cursor-pointer"
              title="Entrar com GitHub"
            >
              <svg className="h-5 w-5 fill-white" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            </button>
          </div>

          {/* ── 8. Chamada para Criar Conta / Fazer Login ── */}
          <div className="mt-7 text-center text-xs text-slate-400">
            <span>{isLogin ? "Novo no CupomHub?" : "Já possui uma conta?"}</span>
            <button
              type="button"
              onClick={toggleMode}
              className="ml-1.5 font-semibold text-emerald-400 hover:text-emerald-300 hover:underline transition-colors cursor-pointer"
            >
              {isLogin ? "Criar conta" : "Fazer login"}
            </button>
          </div>

          {/* ── 9. Links Legais no Rodapé ── */}
          <div className="mt-5 flex items-center justify-center gap-3 text-[11px] text-slate-500">
            <Link
              href="/privacidade"
              className="hover:text-slate-300 hover:underline transition-colors"
            >
              Privacidade
            </Link>
            <span>•</span>
            <Link
              href="/termos"
              className="hover:text-slate-300 hover:underline transition-colors"
            >
              Termos de Uso
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export function LoginGlass() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <LoginFormContent />
    </GoogleOAuthProvider>
  );
}
