"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearSession, getAccessToken } from "@/lib/auth-api";
import { SplashScreen } from "./SplashScreen";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001").replace(/\/$/, "");

// Tempo total da animação CSS (Gooey 0-1.7s + MacBook 1.0-4.9s + Transição Frontal 5.4-6.4s + pausa de leitura)
const SPLASH_DURATION_MS = 6600;
const SPLASH_FADE_MS = 350;

function decodeJwtPayload(payloadB64: string): any {
  try {
    const bin = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const json = decodeURIComponent(
      bin
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    try {
      return JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return null;
    }
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const payload = decodeJwtPayload(parts[1]);
    if (!payload || typeof payload.exp !== "number") return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch {
    return true;
  }
}

function isMobileViewportOrDevice(): boolean {
  if (typeof window === "undefined") return false;
  const mobileMedia = window.matchMedia?.("(max-width: 768px)")?.matches;
  const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ""
  );
  const standalonePwa =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (window.navigator as any)?.standalone === true;
  return Boolean(mobileMedia || mobileUA || standalonePwa);
}

export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [fadingOut, setFadingOut] = useState(false);
  const splashTimerStartedRef = useRef(false);

  useEffect(() => {
    const checkTokenAndRedirect = () => {
      const token = getAccessToken();
      if (!token || isTokenExpired(token)) {
        setReady(false);
        clearSession();
        router.replace("/login");
        return false;
      }
      return true;
    };

    // Initial check
    const isValid = checkTokenAndRedirect();
    if (isValid) {
      setReady(true);

      if (!splashTimerStartedRef.current) {
        splashTimerStartedRef.current = true;
        const isMobile = isMobileViewportOrDevice();
        const justLoggedIn =
          typeof window !== "undefined" &&
          sessionStorage.getItem("cupomhub_just_logged_in") === "1";
        const alreadyShownDesktop =
          typeof window !== "undefined" &&
          sessionStorage.getItem("cupomhub_splash_shown") === "1";

        if (typeof window !== "undefined") {
          sessionStorage.removeItem("cupomhub_just_logged_in");
          sessionStorage.setItem("cupomhub_splash_shown", "1");
        }

        // No mobile sempre exibe o splash screen ao entrar no sistema;
        // no desktop exibe ao entrar no sistema pela primeira vez na sessão ou após login.
        const shouldPlayFullSplash = isMobile || justLoggedIn || !alreadyShownDesktop;

        if (shouldPlayFullSplash) {
          const fadeTimer = setTimeout(() => {
            setFadingOut(true);
          }, SPLASH_DURATION_MS);

          const hideTimer = setTimeout(() => {
            setShowSplash(false);
          }, SPLASH_DURATION_MS + SPLASH_FADE_MS);

          return () => {
            clearTimeout(fadeTimer);
            clearTimeout(hideTimer);
          };
        } else {
          setShowSplash(false);
        }
      }
    }
  }, [router]);

  useEffect(() => {
    const checkTokenAndRedirect = () => {
      const token = getAccessToken();
      if (!token || isTokenExpired(token)) {
        setReady(false);
        clearSession();
        router.replace("/login");
        return false;
      }
      return true;
    };

    // Set up periodic checks (every 5 seconds) and event listeners for focus/visibility changes.
    // This handles background expiration when the user wakes the device or switches tabs,
    // which is particularly helpful on mobile Safari.
    const interval = setInterval(checkTokenAndRedirect, 5000);
    window.addEventListener("visibilitychange", checkTokenAndRedirect);
    window.addEventListener("focus", checkTokenAndRedirect);

    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof originalFetch>) => {
      try {
        const response = await originalFetch(...args);

        const input = args[0];
        let urlString = "";
        if (typeof input === "string") {
          urlString = input;
        } else if (input instanceof URL) {
          urlString = input.href;
        } else if (input && typeof input === "object" && "url" in input) {
          urlString = input.url;
        }

        const isApiRequest = urlString.startsWith(API_URL) || urlString.startsWith("/");

        if (response.status === 401 && isApiRequest) {
          setReady(false);
          clearSession();
          router.replace("/login");
        }
        return response;
      } catch (error) {
        // If the fetch call failed/rejected (which can happen on iOS Safari when the request fails
        // on a 401 due to WWW-Authenticate headers), double-check if the token has expired.
        const token = getAccessToken();
        if (token && isTokenExpired(token)) {
          setReady(false);
          clearSession();
          router.replace("/login");
        }
        throw error;
      }
    };

    return () => {
      clearInterval(interval);
      window.removeEventListener("visibilitychange", checkTokenAndRedirect);
      window.removeEventListener("focus", checkTokenAndRedirect);
      window.fetch = originalFetch;
    };
  }, [router]);

  if (!ready) {
    return <SplashScreen />;
  }

  return (
    <>
      {showSplash && <SplashScreen fadingOut={fadingOut} />}
      {children}
    </>
  );
}
