"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useSessionProfileColor } from "@/lib/profile-color";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaRegistration() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const { color } = useSessionProfileColor();

  useEffect(() => {
    // Verificar se já está em modo PWA standalone
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    ) {
      setIsStandalone(true);
      return;
    }

    // Registrar o Service Worker
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

    // Capturar o evento beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Evento quando o app for instalado com sucesso
    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      console.log("[PWA] App instalado com sucesso!");
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  // Se já estiver em standalone ou o prompt não foi disparado ou usuário fechou, não exibe o banner
  if (isStandalone || !installPrompt || isDismissed) {
    return null;
  }

  return (
    <aside
      aria-label="Instalação do Aplicativo"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300"
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
            Acesso rápido direto da sua tela inicial
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleInstallClick}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white shadow-sm hover:opacity-90 active:scale-95 transition-all"
          style={{ backgroundColor: color || "#047857" }}
        >
          Instalar
        </button>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Dispensar aviso de instalação"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
