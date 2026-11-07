"use client";

import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, PiggyBank, CheckCircle } from "lucide-react";
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

function GoogleButtonContent({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="group relative flex w-full h-12 items-center justify-center gap-3.5 rounded-xl border border-slate-200/80 bg-white px-6 font-semibold text-slate-800 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50/80 hover:shadow-md active:scale-[0.99] disabled:opacity-60"
    >
      {/* Ícone oficial do Google */}
      <svg className="h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110" viewBox="0 0 24 24">
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
      <span className="text-sm font-semibold text-slate-800">
        {loading ? "Autenticando..." : "Continuar com o Google"}
      </span>
      <span className="absolute right-4 rounded bg-emerald-100/90 px-2 py-0.5 text-xs font-semibold text-emerald-800">
        Rápido
      </span>
    </button>
  );
}

function CustomGoogleLoginButton({
  onSuccess,
  onError,
  loading,
}: {
  onSuccess: (idToken: string) => void;
  onError: (err: string) => void;
  loading: boolean;
}) {
  // Configuração do login via Google OAuth Popup
  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        // Tenta obter as credenciais/userInfo através do access_token
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        await res.json();

        // Se temos o access_token, passamos via token especial ou tratamos via backend
        // Caso tenhamos tokenResponse.access_token, fazemos a troca ou passamos o token
        if (tokenResponse.access_token) {
          onSuccess(tokenResponse.access_token);
        }
      } catch {
        onError("Falha ao obter perfil do Google");
      }
    },
    onError: () => {
      onError("Login com Google cancelado ou falhou");
    },
  });

  return <GoogleButtonContent onClick={() => handleGoogleLogin()} loading={loading} />;
}

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

  const triggerNativeGooglePrompt = () => {
    const win = window as any;
    if (win.google?.accounts?.id) {
      win.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: { credential?: string }) => {
          if (response.credential) {
            await handleGoogleSuccess(response.credential);
          }
        },
      });
      win.google.accounts.id.prompt();
    }
  };

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
    if (!cleanEmail.includes("@") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
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
    <main className="relative w-full min-h-screen bg-white flex flex-col justify-center items-center font-sans antialiased overflow-hidden">

      <div className="relative z-10 w-full min-h-screen flex flex-col lg:flex-row bg-transparent">
        {/* LADO ESQUERDO: Hero Visual & Proposta de Valor (Stitch Desktop Design) */}
        <div className="relative hidden lg:flex lg:w-7/12 xl:w-3/5 overflow-hidden flex-col justify-between p-12 lg:p-16">
          {/* Background Imagem Supermercado para Desktop */}
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
            style={{
              backgroundImage:
                "url('https://lh3.googleusercontent.com/aida-public/AB6AXuA3NhP2A1HC5DeZm_rs7lfz-oh5U3yb7-1lKWL58UTvzXxp-DL6knVOpTOUovZKOi7MUZkkI4xBkJG2EFgpNuFREbxepJmHIbGF_GYXJGwBzgrAXvhiS0oVvn6UOLiaJlsL1AP5r7MmhYJd2Inz0lCVbzvXdIIfQZ_bKC4OiijKP5Dpzk_3hNfSxLIc0xGYifsMevK-Br2e7mMivUpGe_jYshHk20s6SBd6kMJOgpmeAj2mXxwnUaO_SveQeZuBYVJncgo')",
            }}
          />
          {/* Overlay Gradiente Azul Marinho Oficial da Marca (#002545) */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#002545]/95 via-[#0e3b64]/85 to-[#002545]/70 backdrop-blur-[2px]" />

          {/* Luzes decorativas de fundo */}
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
          <div className="absolute bottom-12 right-12 h-80 w-80 rounded-full bg-blue-400/15 blur-3xl pointer-events-none" />

          {/* Conteúdo Central & Proposta de Valor */}
          <div className="relative z-10 max-w-xl my-auto py-12 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-semibold text-xs border border-emerald-400/30 shadow-sm backdrop-blur-md">
              <PiggyBank className="h-4 w-4 text-emerald-400" />
              <span>Controle inteligente de gastos domésticos</span>
            </div>

            <h1 className="text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Economize de verdade em cada ida ao supermercado.
            </h1>

            <p className="text-base text-slate-200/90 leading-relaxed max-w-lg">
              Escaneie suas notas fiscais via QR Code, acompanhe o histórico detalhado de preços por produto e compare redes de supermercados com total transparência.
            </p>

            <div className="pt-4 flex items-center gap-4 text-xs font-medium text-slate-300">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl backdrop-blur-md">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span>NFC-e Automatizado</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl backdrop-blur-md">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Dados Auditados</span>
              </div>
            </div>
          </div>

          {/* Rodapé do Banner */}
          <div className="relative z-10 flex items-center justify-between text-xs text-slate-300/80 border-t border-white/10 pt-6">
            <span>© 2026 CupomHub. Todos os direitos reservados.</span>
            <span className="font-semibold text-emerald-400">Google Stitch Design Verified</span>
          </div>
        </div>

        {/* LADO DIREITO: Painel de Autenticação (textura no lugar do fundo branco) */}
        <div className="login-texture relative w-full lg:w-5/12 xl:w-2/5 flex flex-col justify-center p-6 sm:p-8 lg:p-12 xl:p-16 overflow-y-auto overflow-x-hidden min-h-screen lg:min-h-0">
          <div className="relative z-10 w-full max-w-md mx-auto my-auto py-4">
            {/* Header com a Marca CupomHub */}
            <div className="mb-6 text-left pt-2 lg:pt-0">
              <div className="flex items-center gap-3 mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1b6d24] text-white shadow-md shadow-emerald-900/10">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                  </svg>
                </div>
                <div>
                  <span className="text-xl font-extrabold text-[#002545] tracking-tight block">CupomHub</span>
                  <span className="text-[11px] font-medium text-slate-500 block -mt-1">Gestão de Compras & Preços</span>
                </div>
              </div>

              <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-1.5">
                {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                {isLogin
                  ? "Acesse sua conta para gerenciar seus cupons e listas."
                  : "Cadastre-se com seu e-mail para começar a economizar."}
              </p>
            </div>

            {/* Botão de Autenticação Google SSO */}
            <div className="mb-5">
              <CustomGoogleLoginButton
                onSuccess={handleGoogleSuccess}
                onError={(msg) => {
                  triggerNativeGooglePrompt();
                  setError(msg);
                }}
                loading={loading}
              />
            </div>

            {/* Divisor Elegante */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-300/70" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                {isLogin ? "ou entre com seu e-mail" : "ou cadastre-se com seu e-mail"}
              </span>
              <div className="flex-1 h-px bg-slate-300/70" />
            </div>

            {/* Formulário de Autenticação */}
            <form onSubmit={isLogin ? onLogin : onRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {isLogin ? "E-mail ou Usuário" : "E-mail"}
                </label>
                <div className="relative rounded-xl border border-slate-200 bg-white/80 shadow-sm transition-all focus-within:border-[#1b6d24] focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/10">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
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
                    className="block w-full pl-10 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Senha
                </label>
                <div className="relative rounded-xl border border-slate-200 bg-white/80 shadow-sm transition-all focus-within:border-[#1b6d24] focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/10">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-11 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent rounded-xl focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirmar Senha
                  </label>
                  <div className="relative rounded-xl border border-slate-200 bg-white/80 shadow-sm transition-all focus-within:border-[#1b6d24] focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-600/10">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full pl-10 pr-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 bg-transparent rounded-xl focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {isLogin && (
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <div className="flex items-center gap-2 select-none">
                    <button
                      type="button"
                      role="switch"
                      id="remember-me"
                      aria-checked={remember}
                      aria-label="Lembrar de mim"
                      onClick={() => setRemember((prev) => !prev)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${
                        remember ? "bg-emerald-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          remember ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <label htmlFor="remember-me" className="font-medium text-slate-600 cursor-pointer">
                      Lembrar de mim
                    </label>
                  </div>
                  <button
                    type="button"
                    className="font-semibold text-[#002545] hover:text-[#1b6d24] hover:underline"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-center text-xs font-medium text-red-600">
                  {error}
                </div>
              )}

              {/* Botão Primário (Verde Esmeralda #1b6d24 do Stitch) */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 h-11 sm:h-12 px-6 rounded-xl bg-[#1b6d24] text-white font-semibold text-xs sm:text-sm shadow-md hover:bg-[#15571d] hover:shadow-lg transition-all duration-200 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                >
                  <span>{loading ? "Autenticando..." : isLogin ? "Entrar na Conta" : "Criar Conta"}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>

            {/* Chamada para Cadastro (Card de rodapé do Stitch) */}
            <div className="mt-6 mb-2 p-3.5 rounded-2xl bg-white/75 backdrop-blur-md border border-white/70 flex items-center justify-between text-left">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-slate-900">
                  {isLogin ? "Novo no CupomHub?" : "Já possui uma conta?"}
                </span>
                <span className="text-[11px] text-slate-500">
                  {isLogin ? "Comece a economizar agora mesmo." : "Acesse o painel com seus dados."}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleMode}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[#002545] font-semibold text-xs hover:bg-slate-100 shadow-sm transition-colors whitespace-nowrap"
              >
                {isLogin ? "Criar conta" : "Fazer login"}
              </button>
            </div>

            {/* Links Legais (Política de Privacidade e Termos de Serviço) */}
            <div className="mt-4 flex items-center justify-center gap-3 text-xs font-medium text-slate-700 lg:text-slate-500">
              <Link href="/privacidade" className="hover:text-slate-600 hover:underline transition-colors">
                Política de Privacidade
              </Link>
              <span>•</span>
              <Link href="/termos" className="hover:text-slate-600 hover:underline transition-colors">
                Termos de Serviço
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function LoginGlass() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || ""}>
      <LoginFormContent />
    </GoogleOAuthProvider>
  );
}
