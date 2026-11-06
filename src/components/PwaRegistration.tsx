"use client";

import { useEffect, useState } from "react";
import { Download, X, Share2, PlusSquare, MoreVertical, Smartphone, CheckCircle2, Info } from "lucide-react";
import { useSessionProfileColor } from "@/lib/profile-color";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const STORAGE_KEY_DISMISSED = "cupomhub_pwa_dismissed_until";
const DISMISS_DAYS = 7; // Não incomoda o usuário novamente por 7 dias se ele dispensar

export function PwaRegistration() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(true); // Inicia oculto até checar o localStorage no cliente
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"ios" | "android">("ios");
  const { color } = useSessionProfileColor();

  useEffect(() => {
    // 1. Verificar se já está rodando como app standalone (instalado)
    const checkStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (checkStandalone) {
      setIsStandalone(true);
      return;
    }

    // 2. Verificar se o usuário já dispensou nos últimos dias
    try {
      const dismissedUntil = localStorage.getItem(STORAGE_KEY_DISMISSED);
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        setIsDismissed(true);
      } else {
        setIsDismissed(false);
      }
    } catch {
      setIsDismissed(false);
    }

    // 3. Detectar se é dispositivo iOS (iPhone, iPad, iPod)
    const ua = window.navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

    if (isIOS) {
      setIsIOSDevice(true);
      setActiveTab("ios");
    } else {
      setActiveTab("android");
    }

    // 4. Registrar o Service Worker em produção
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("[PWA] Service Worker registrado com escopo:", registration.scope);
          })
          .catch((error) => {
            console.warn("[PWA] Falha ao registrar Service Worker:", error);
          });
      });
    }

    // 5. Capturar evento nativo do Android / Chromium
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // 6. Evento quando o app for instalado com sucesso
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      try {
        localStorage.setItem(STORAGE_KEY_DISMISSED, (Date.now() + 365 * 24 * 60 * 60 * 1000).toString());
      } catch {}
      console.log("[PWA] App instalado com sucesso!");
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      const snoozeUntil = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(STORAGE_KEY_DISMISSED, snoozeUntil.toString());
    } catch {
      // Ignora erro de local storage desativado
    }
  };

  const handleActionClick = async () => {
    // Se for iOS ou navegador sem prompt automático, abre o modal instrutivo
    if (isIOSDevice || !installPrompt) {
      setShowInstructionsModal(true);
      return;
    }

    // Se for Android/Chromium com prompt nativo disponível
    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") {
        setInstallPrompt(null);
        handleDismiss();
      }
    } catch {
      setShowInstructionsModal(true);
    }
  };

  // Se já estiver em standalone ou foi dispensado temporariamente, não renderiza o banner fixo
  const shouldShowBanner = !isStandalone && !isDismissed && (installPrompt !== null || isIOSDevice);

  return (
    <>
      {/* Banner de Instalação Flutuante */}
      {shouldShowBanner && (
        <aside
          aria-label="Instalação do Aplicativo"
          className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
              style={{ backgroundColor: color || "#047857" }}
            >
              <Download className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                Instalar CupomHub
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {isIOSDevice
                  ? "Adicione à Tela de Início do iPhone"
                  : "Acesso rápido sem barra de navegação"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleActionClick}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
              style={{ backgroundColor: color || "#047857" }}
            >
              {isIOSDevice ? "Como instalar" : "Instalar"}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Dispensar aviso de instalação"
              title="Dispensar aviso por 7 dias"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {/* Modal / Tutorial com instruções visuais para iPhone e Android */}
      {showInstructionsModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                  style={{ backgroundColor: color || "#047857" }}
                >
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base">
                  Como instalar o App
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInstructionsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                aria-label="Fechar guia"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alternador de Sistema (iOS / Android) */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("ios")}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === "ios"
                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                iPhone (iOS / Safari)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("android")}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === "android"
                    ? "bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Android (Chrome)
              </button>
            </div>

            {/* Conteúdo iOS */}
            {activeTab === "ios" && (
              <div className="space-y-3 text-sm">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No Safari do iOS, siga estes 3 passos rápidos:
                </p>

                <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      Toque em Compartilhar <Share2 className="w-4 h-4 text-blue-500 inline" />
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Localizado na barra inferior do Safari (ícone do quadrado com a seta para cima).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      Adicionar à Tela de Início <PlusSquare className="w-4 h-4 text-emerald-600 inline" />
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Role o menu de opções para baixo e toque nesta opção com ícone de &quot;+&quot;.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      Confirme em &quot;Adicionar&quot; <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Toque em &quot;Adicionar&quot; no canto superior direito para finalizar.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Conteúdo Android */}
            {activeTab === "android" && (
              <div className="space-y-3 text-sm">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No Google Chrome do Android:
                </p>

                <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      Toque nos 3 pontos <MoreVertical className="w-4 h-4 text-slate-600 inline" />
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      No canto superior direito da janela do navegador.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      Instalar aplicativo <Download className="w-4 h-4 text-emerald-600 inline" />
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Ou selecione &quot;Adicionar à tela inicial&quot; e confirme.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                  <Info className="w-4 h-4 shrink-0" />
                  <span>
                    Caso o botão &quot;Instalar&quot; automático tenha aparecido, basta clicar nele!
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowInstructionsModal(false);
                handleDismiss();
              }}
              className="w-full py-2.5 rounded-xl text-white font-semibold text-sm shadow-md transition-all active:scale-95"
              style={{ backgroundColor: color || "#047857" }}
            >
              Entendi, obrigado!
            </button>
          </div>
        </div>
      )}
    </>
  );
}