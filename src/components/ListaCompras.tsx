"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ClipboardList,
  Edit2,
  Check,
  X,
  ArrowLeft,
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  Trash2,
  Plus,
  Minus,
  Send,
  Store,
  History,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { useSessionProfileColor } from "@/lib/profile-color";
import { getAuthHeaders } from "@/lib/auth-api";
import {
  MercadoHistorico,
  ItemRascunho,
  ListaComprasData,
  ProdutoApelido,
} from "@/interface/ListaCompras/IListaCompras";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

const UNIDADES_DISPONIVEIS = ["UN", "KG", "G", "L", "ML", "PCT", "CX", "LATA", "BJ", "FD", "DZ"];

export function ListaCompras() {
  const { color, preset } = useSessionProfileColor();
  const secondaryColor = preset ? preset.secondaryHex : color;

  const [mercados, setMercados] = useState<MercadoHistorico[]>([]);
  const [selectedCnpj, setSelectedCnpj] = useState<string | null>(null);
  const [periodoMeses, setPeriodoMeses] = useState<number>(3);
  const [lista, setLista] = useState<ListaComprasData | null>(null);
  const [apelidos, setApelidos] = useState<ProdutoApelido[]>([]);

  // Mode: 'voz' (default for building list as things run out) or 'recorrencia'
  const [modoCriacao, setModoCriacao] = useState<"voz" | "recorrencia">("voz");

  // Draft (rascunho) state persisted in MongoDB
  const [rascunhoItens, setRascunhoItens] = useState<ItemRascunho[]>([]);
  const [incluirSugestoesRecorrentes, setIncluirSugestoesRecorrentes] = useState<boolean>(false);

  // Voice & NLP state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [textoComandoVoz, setTextoComandoVoz] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [processandoVoz, setProcessandoVoz] = useState<boolean>(false);
  const [vozFeedback, setVozFeedback] = useState<{ tipo: "sucesso" | "erro"; msg: string } | null>(null);
  const [suportaReconhecimentoVoz, setSuportaReconhecimentoVoz] = useState<boolean>(true);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const latestTranscriptRef = useRef<string>("");
  const usarGravadorAudioRef = useRef<boolean>(false);
  const textareaVozRef = useRef<HTMLTextAreaElement | null>(null);
  const inputVozAtivaRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMercados, setLoadingMercados] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [showChecked, setShowChecked] = useState<boolean>(true);

  const [apelidoModal, setApelidoModal] = useState<{
    open: boolean;
    nomeOriginal: string;
    apelido: string;
  }>({ open: false, nomeOriginal: "", apelido: "" });

  const [pendingChanges, setPendingChanges] = useState<{ index: number; comprado: boolean }[]>([]);
  const [changeCount, setChangeCount] = useState<number>(0);

  // Check browser Web Speech API / MediaRecorder support on iPhone & mobile
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

      // No iPhone/iOS (seja Safari, PWA na tela de início ou Chrome iOS), o webkitSpeechRecognition
      // perde o stream de áudio durante o popup de permissão ou fica mudo sem emitir onresult.
      // Por isso, no iOS usamos diretamente o MediaRecorder + Gemini Audio (com await getUserMedia antes de iniciar!).
      if (isIOS && hasMediaDevices) {
        usarGravadorAudioRef.current = true;
      }

      if (!SpeechRecognition && !hasMediaDevices) {
        setSuportaReconhecimentoVoz(false);
      }
    }
  }, []);

  const fetchApelidos = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/lista-compras/apelidos`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setApelidos(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchRascunho = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/lista-compras/rascunho`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRascunhoItens(Array.isArray(data?.itens) ? data.itens : []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadMercados = useCallback(async () => {
    try {
      setLoadingMercados(true);
      const res = await fetch(`${API_URL}/lista-compras/mercados`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMercados(data);
        if (data.length > 0 && !selectedCnpj) {
          setSelectedCnpj(data[0].cnpj);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMercados(false);
    }
  }, [selectedCnpj]);

  const loadExistingList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/lista-compras`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();

        const storedPending = localStorage.getItem("lista_compras_pending");
        if (storedPending) {
          const parsedPending = JSON.parse(storedPending) as {
            index: number;
            comprado: boolean;
          }[];

          parsedPending.forEach((change) => {
            if (data.itens[change.index]) {
              data.itens[change.index].comprado = change.comprado;
            }
          });

          setPendingChanges(parsedPending);
          setChangeCount(parsedPending.length);
        }

        setLista(data);
      } else if (res.status === 404) {
        setLista(null);
        await Promise.all([loadMercados(), fetchRascunho()]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [loadMercados, fetchRascunho]);

  useEffect(() => {
    fetchApelidos();
    loadExistingList();
  }, [fetchApelidos, loadExistingList]);

  // Cleanup speech recognition & audio stream on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Sync batch changes
  const syncBatchChanges = useCallback(
    async (changes: { index: number; comprado: boolean }[]) => {
      if (changes.length === 0) return;
      try {
        await fetch(`${API_URL}/lista-compras/itens`, {
          method: "PATCH",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ itens: changes }),
        });
        localStorage.removeItem("lista_compras_pending");
        setPendingChanges([]);
        setChangeCount(0);
      } catch (err) {
        console.error(err);
      }
    },
    []
  );

  useEffect(() => {
    if (changeCount >= 10) {
      syncBatchChanges(pendingChanges);
    }
  }, [changeCount, pendingChanges, syncBatchChanges]);

  // ==================== COMANDO DE VOZ (IPHONE / SAFARI / PWA / ANDROID) ====================

  const processarRespostaVozBackend = useCallback(
    (data: any, naListaAtiva: boolean) => {
      if (naListaAtiva) {
        setLista(data);
        setVozFeedback({
          tipo: "sucesso",
          msg: "Itens adicionados e vinculados com o histórico do mercado!",
        });
      } else {
        if (data?.rascunho?.itens) {
          setRascunhoItens(data.rascunho.itens);
        }
        const qtdExtraidos = Array.isArray(data?.itensExtraidos)
          ? data.itensExtraidos.length
          : 1;
        const resumoExtraidos = Array.isArray(data?.itensExtraidos)
          ? data.itensExtraidos
              .map((i: ItemRascunho) => `${i.quantidade} ${i.unidade} ${i.termoFalado}`)
              .join(", ")
          : "";
        const fraseTranscrita = data?.textoTranscrito
          ? `"${data.textoTranscrito}" → `
          : "";

        setVozFeedback({
          tipo: "sucesso",
          msg: `${fraseTranscrita}${qtdExtraidos} item(ns) anotado(s): ${resumoExtraidos}`,
        });
      }

      setTextoComandoVoz("");
      setInterimTranscript("");
      latestTranscriptRef.current = "";
    },
    []
  );

  const enviarTextoComandoVoz = useCallback(
    async (textoParaEnviar: string, naListaAtiva = false) => {
      const limpo = textoParaEnviar.trim();
      if (!limpo) return;

      try {
        setProcessandoVoz(true);
        setVozFeedback(null);

        const endpoint = naListaAtiva
          ? `${API_URL}/lista-compras/voz-ativa`
          : `${API_URL}/lista-compras/rascunho/voz`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ textoFalado: limpo }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData?.message || "Não conseguimos identificar os produtos nesse comando."
          );
        }

        const data = await res.json();
        processarRespostaVozBackend(data, naListaAtiva);
      } catch (err: any) {
        setVozFeedback({
          tipo: "erro",
          msg: err?.message || "Erro ao processar comando de voz.",
        });
      } finally {
        setProcessandoVoz(false);
      }
    },
    [processarRespostaVozBackend]
  );

  const enviarAudioComandoVoz = useCallback(
    async (audioBase64: string, mimeType: string, naListaAtiva = false) => {
      if (!audioBase64) return;

      try {
        setProcessandoVoz(true);
        setVozFeedback(null);

        const endpoint = naListaAtiva
          ? `${API_URL}/lista-compras/voz-ativa`
          : `${API_URL}/lista-compras/rascunho/voz`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ audioBase64, mimeType }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData?.message ||
              "Não foi possível transcrever o áudio. Tente falar mais próximo ao microfone."
          );
        }

        const data = await res.json();
        processarRespostaVozBackend(data, naListaAtiva);
      } catch (err: any) {
        setVozFeedback({
          tipo: "erro",
          msg: err?.message || "Erro ao processar áudio de voz.",
        });
      } finally {
        setProcessandoVoz(false);
      }
    },
    [processarRespostaVozBackend]
  );

  const iniciarGravacaoMediaRecorder = useCallback(
    async (naListaAtiva = false) => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Microfone indisponível neste navegador.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        audioChunksRef.current = [];

        // Escolhe o formato suportado pelo iPhone (audio/mp4) ou Chrome/Android (audio/webm)
        const mimeTypesPreferidos = [
          "audio/mp4",
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/ogg",
        ];
        let mimeEscolhido = "";
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
          for (const m of mimeTypesPreferidos) {
            if (MediaRecorder.isTypeSupported(m)) {
              mimeEscolhido = m;
              break;
            }
          }
        }

        const recorder = mimeEscolhido
          ? new MediaRecorder(stream, { mimeType: mimeEscolhido })
          : new MediaRecorder(stream);

        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          setIsListening(false);
          setInterimTranscript("");
          const mimeFinal = recorder.mimeType || mimeEscolhido || "audio/mp4";
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeFinal });

          if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((t) => t.stop());
            mediaStreamRef.current = null;
          }

          if (audioBlob.size < 200) {
            return;
          }

          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = String(reader.result || "");
            if (base64data) {
              enviarAudioComandoVoz(base64data, mimeFinal, naListaAtiva);
            }
          };
          reader.readAsDataURL(audioBlob);
        };

        // Passa timeslice de 250ms para garantir que o Safari iOS grave os chunks de áudio continuamente
        recorder.start(250);
        setIsListening(true);
        setInterimTranscript(
          "Ouvindo sua voz... Fale os itens e toque no botão vermelho para enviar."
        );
      } catch {
        setIsListening(false);
        // Foca o campo de texto para permitir usar o Ditado nativo do teclado do iPhone
        if (naListaAtiva) {
          inputVozAtivaRef.current?.focus();
        } else {
          textareaVozRef.current?.focus();
        }
        setVozFeedback({
          tipo: "erro",
          msg: "Para falar no iPhone sem HTTPS ou sem permissão do Safari, toque no ícone de microfone 🎙️ no teclado do iPhone que acabou de abrir!",
        });
      }
    },
    [enviarAudioComandoVoz]
  );

  const toggleMicrofone = (naListaAtiva = false) => {
    // 1. Se já estiver ouvindo/gravando, para e envia
    if (isListening) {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      const textoCapturado = (
        latestTranscriptRef.current ||
        `${textoComandoVoz} ${interimTranscript}`
      ).trim();

      if (textoCapturado) {
        latestTranscriptRef.current = "";
        enviarTextoComandoVoz(textoCapturado, naListaAtiva);
      }
      return;
    }

    if (typeof window === "undefined") return;

    // 2. Se estiver acessando no iPhone via IP local HTTP (sem HTTPS), o iOS bloqueia APIs de microfone no browser.
    // Focamos imediatamente o input/textarea para abrir o teclado do iPhone com o botão de Ditado da Apple (🎙️).
    if (!window.isSecureContext) {
      if (naListaAtiva) {
        inputVozAtivaRef.current?.focus();
      } else {
        textareaVozRef.current?.focus();
      }
      setVozFeedback({
        tipo: "erro",
        msg: "Em conexão local HTTP no iPhone, o iOS exige HTTPS para microfone direto. Use o microfone 🎙️ do teclado do iPhone no campo selecionado!",
      });
      return;
    }

    setVozFeedback(null);
    setInterimTranscript("");
    latestTranscriptRef.current = textoComandoVoz ? `${textoComandoVoz} ` : "";

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    // 3. No iOS (iPhone/iPad) ou quando usarGravadorAudioRef estiver ativo, usa MediaRecorder + Gemini Audio diretamente
    if (!SpeechRecognition || isIOS || usarGravadorAudioRef.current) {
      iniciarGravacaoMediaRecorder(naListaAtiva);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "pt-BR";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      let acumuladoFinal = textoComandoVoz ? `${textoComandoVoz} ` : "";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let provisorio = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            acumuladoFinal += transcript + ", ";
            setTextoComandoVoz(acumuladoFinal.trim());
          } else {
            provisorio += transcript;
          }
        }
        setInterimTranscript(provisorio);
        latestTranscriptRef.current = `${acumuladoFinal} ${provisorio}`.trim();
      };

      recognition.onerror = (event: any) => {
        console.warn("SpeechRecognition error:", event.error);
        setIsListening(false);

        if (
          event.error === "service-not-allowed" ||
          event.error === "not-allowed" ||
          event.error === "network"
        ) {
          usarGravadorAudioRef.current = true;
          iniciarGravacaoMediaRecorder(naListaAtiva);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript("");

        const textoCapturado = latestTranscriptRef.current.trim();
        if (textoCapturado) {
          latestTranscriptRef.current = "";
          enviarTextoComandoVoz(textoCapturado, naListaAtiva);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      usarGravadorAudioRef.current = true;
      iniciarGravacaoMediaRecorder(naListaAtiva);
    }
  };

  // ==================== MANIPULAÇÃO DO RASCUNHO ====================

  const salvarRascunhoNoBackend = async (novosItens: ItemRascunho[]) => {
    setRascunhoItens(novosItens);
    try {
      await fetch(`${API_URL}/lista-compras/rascunho`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ itens: novosItens }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const alterarQuantidadeRascunho = (index: number, delta: number) => {
    const copia = [...rascunhoItens];
    const atual = copia[index];
    if (!atual) return;
    const novaQtd = Number(Math.max(0.5, atual.quantidade + delta).toFixed(2));
    copia[index] = { ...atual, quantidade: novaQtd };
    salvarRascunhoNoBackend(copia);
  };

  const alterarUnidadeRascunho = (index: number, novaUnidade: string) => {
    const copia = [...rascunhoItens];
    if (!copia[index]) return;
    copia[index] = { ...copia[index], unidade: novaUnidade };
    salvarRascunhoNoBackend(copia);
  };

  const removerItemRascunho = (index: number) => {
    const copia = rascunhoItens.filter((_, i) => i !== index);
    salvarRascunhoNoBackend(copia);
  };

  const limparTodoRascunho = async () => {
    setRascunhoItens([]);
    try {
      await fetch(`${API_URL}/lista-compras/rascunho`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // ==================== GERAR LISTA (RAG OU RECORRÊNCIA) ====================

  const handleProcessarRagNoMercado = async () => {
    if (!selectedCnpj || rascunhoItens.length === 0) return;
    try {
      if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
      setGenerating(true);
      const res = await fetch(`${API_URL}/lista-compras/processar-rag`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          cnpj: selectedCnpj,
          incluirSugestoesRecorrentes,
          periodoMeses,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.removeItem("lista_compras_pending");
        setPendingChanges([]);
        setChangeCount(0);
        setRascunhoItens([]);
        setLista(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleGerarListaRecorrencia = async () => {
    if (!selectedCnpj) return;
    try {
      setGenerating(true);
      const res = await fetch(`${API_URL}/lista-compras/gerar`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ cnpj: selectedCnpj, periodoMeses }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.removeItem("lista_compras_pending");
        setPendingChanges([]);
        setChangeCount(0);
        setLista(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const formatCnpj = (cnpj: string) =>
    cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  const formatCurrency = (val: number) =>
    (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const toggleItem = async (index: number) => {
    if (!lista) return;

    const newLista = { ...lista };
    const currentItem = newLista.itens[index];
    const novoComprado = !currentItem.comprado;

    currentItem.comprado = novoComprado;
    setLista(newLista);

    const newPending = [...pendingChanges];
    const existingIndex = newPending.findIndex((p) => p.index === index);
    if (existingIndex >= 0) {
      newPending[existingIndex].comprado = novoComprado;
    } else {
      newPending.push({ index, comprado: novoComprado });
    }

    setPendingChanges(newPending);
    setChangeCount((c) => c + 1);
    localStorage.setItem("lista_compras_pending", JSON.stringify(newPending));
  };

  const handleSaveApelido = async () => {
    try {
      const res = await fetch(`${API_URL}/lista-compras/apelidos`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          nomeOriginal: apelidoModal.nomeOriginal,
          apelido: apelidoModal.apelido,
        }),
      });
      if (res.ok) {
        await fetchApelidos();
        setApelidoModal({ open: false, nomeOriginal: "", apelido: "" });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getApelidoName = (nomeOriginal: string) => {
    const ap = apelidos.find((a) => a.nomeOriginal === nomeOriginal);
    return ap ? ap.apelido : null;
  };

  const deleteList = async () => {
    try {
      if (pendingChanges.length > 0) {
        await syncBatchChanges(pendingChanges);
      }
      await fetch(`${API_URL}/lista-compras`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      setLista(null);
      localStorage.removeItem("lista_compras_pending");
      setPendingChanges([]);
      setChangeCount(0);
      await Promise.all([loadMercados(), fetchRascunho()]);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <Loader2 className="h-10 w-10 animate-spin text-green-600 mb-4" />
        <p className="text-gray-500 font-medium text-center text-sm sm:text-base">Carregando sua lista de compras...</p>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="book-loader">
          <div>
            <ul>
              {[...Array(6)].map((_, i) => (
                <li key={i}>
                  <svg viewBox="0 0 90 120" fill="currentColor">
                    <rect width="90" height="120" rx="4" />
                  </svg>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-6 text-gray-700 font-semibold text-base sm:text-lg text-center">
          Processando produtos no histórico do mercado com IA (RAG)...
        </p>
        <p className="text-xs sm:text-sm text-gray-500 mt-1 text-center max-w-md">
          Relacionando os itens que você falou com os produtos cadastrados nas suas notas fiscais.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 relative">
      <div className="mb-4 sm:mb-6">
        <h1
          className="text-2xl sm:text-3xl font-bold flex items-center gap-2.5 sm:gap-3 mb-1.5 sm:mb-2"
          style={{
            background: `linear-gradient(135deg, ${secondaryColor}, ${color})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          <ClipboardList className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" style={{ color }} />
          <span>Lista de Compras Inteligente</span>
        </h1>
        <p className="text-xs sm:text-sm text-gray-600">
          Vá falando os produtos conforme acabam em casa e processe tudo no mercado escolhido usando IA (PLN + RAG).
        </p>
      </div>

      {!lista ? (
        <div className="space-y-4 sm:space-y-6">
          {/* Seletor de Modo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200">
            <button
              onClick={() => setModoCriacao("voz")}
              className={`flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                modoCriacao === "voz"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Mic className="w-4 h-4 shrink-0" style={{ color: modoCriacao === "voz" ? color : undefined }} />
              <span>Montar por Voz (Conforme Acaba)</span>
              {rascunhoItens.length > 0 && (
                <span
                  className="px-2 py-0.5 text-xs rounded-full text-white font-bold"
                  style={{ backgroundColor: color }}
                >
                  {rascunhoItens.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setModoCriacao("recorrencia")}
              className={`flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl font-semibold text-xs sm:text-sm transition-all ${
                modoCriacao === "recorrencia"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <History
                className="w-4 h-4 shrink-0"
                style={{ color: modoCriacao === "recorrencia" ? color : undefined }}
              />
              <span>Sugerir apenas por Recorrência</span>
            </button>
          </div>

          {modoCriacao === "voz" && (
            <>
              {/* Card de Comando de Voz (PLN) */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6">
                  {/* Botão Microfone Pulsante */}
                  <div className="flex flex-col items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleMicrofone(false)}
                      disabled={processandoVoz}
                      className={`relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-white shadow-xl transition-all duration-300 active:scale-95 ${
                        isListening
                          ? "scale-105 ring-8 ring-red-500/20 bg-red-500 hover:bg-red-600"
                          : "hover:scale-105"
                      }`}
                      style={{
                        background: isListening
                          ? undefined
                          : `linear-gradient(135deg, ${secondaryColor}, ${color})`,
                      }}
                      title={isListening ? "Toque para finalizar e adicionar" : "Toque para falar"}
                    >
                      {processandoVoz ? (
                        <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin" />
                      ) : isListening ? (
                        <MicOff className="w-8 h-8 sm:w-10 sm:h-10 relative z-10" />
                      ) : (
                        <Mic className="w-8 h-8 sm:w-10 sm:h-10 relative z-10" />
                      )}
                    </button>
                    <span className="mt-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">
                      {isListening
                        ? "Ouvindo... Toque p/ enviar"
                        : processandoVoz
                        ? "Extraindo com PLN..."
                        : "Toque para falar"}
                    </span>
                  </div>

                  {/* Área de Transcrição / Digitação */}
                  <div className="flex-1 w-full space-y-2.5 sm:space-y-3">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" style={{ color }} />
                        <span>Fale os itens que estão acabando</span>
                      </h2>
                      <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 leading-relaxed">
                        Ex:{" "}
                        <span className="italic text-gray-600">
                          &ldquo;adicionar 3 limões, 1 kilo de carne moída, azeite, 1 macarrão
                          penne, 1 sal&rdquo;
                        </span>
                      </p>
                    </div>

                    <div className="relative">
                      <textarea
                        ref={textareaVozRef}
                        rows={2}
                        value={
                          isListening && interimTranscript
                            ? `${textoComandoVoz} ${interimTranscript}`.trim()
                            : textoComandoVoz
                        }
                        onChange={(e) => {
                          setTextoComandoVoz(e.target.value);
                          latestTranscriptRef.current = e.target.value;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            enviarTextoComandoVoz(textoComandoVoz, false);
                          }
                        }}
                        placeholder="Aperte o microfone e fale, ou digite aqui os itens..."
                        className="w-full border-2 border-gray-200 rounded-xl px-3.5 py-2.5 pr-12 sm:px-4 sm:py-3 sm:pr-14 text-xs sm:text-sm text-gray-800 focus:outline-none focus:border-green-500 transition-colors resize-none"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          enviarTextoComandoVoz(
                            `${textoComandoVoz} ${interimTranscript}`.trim(),
                            false
                          )
                        }
                        disabled={
                          processandoVoz ||
                          (!textoComandoVoz.trim() && !interimTranscript.trim())
                        }
                        className="absolute right-2.5 bottom-2.5 p-2 sm:p-2.5 rounded-lg text-white shadow-sm disabled:opacity-40 transition-all hover:opacity-90 active:scale-95"
                        style={{
                          background: `linear-gradient(135deg, ${secondaryColor}, ${color})`,
                        }}
                        title="Processar comando (PLN)"
                      >
                        {processandoVoz ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        )}
                      </button>
                    </div>

                    {!suportaReconhecimentoVoz && (
                      <p className="text-xs text-amber-600 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        Dica: Use o ícone de microfone 🎙️ do teclado do celular ou digite os itens acima.
                      </p>
                    )}

                    {vozFeedback && (
                      <div
                        className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between ${
                          vozFeedback.tipo === "sucesso"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        <span>{vozFeedback.msg}</span>
                        <button
                          onClick={() => setVozFeedback(null)}
                          className="ml-2 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Lista de Rascunho Acumulada */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-gray-800">
                      Itens Anotados na Pré-Lista ({rascunhoItens.length})
                    </h3>
                    <p className="text-[11px] sm:text-xs text-gray-500">
                      Salvos automaticamente na sua conta conforme você vai falando ao longo da
                      semana.
                    </p>
                  </div>
                  {rascunhoItens.length > 0 && (
                    <button
                      onClick={limparTodoRascunho}
                      className="self-end sm:self-auto text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Limpar tudo
                    </button>
                  )}
                </div>

                {rascunhoItens.length === 0 ? (
                  <div className="text-center py-8 sm:py-10 bg-gray-50/70 rounded-xl border border-dashed border-gray-200 px-3">
                    <Mic className="w-7 h-7 sm:w-8 sm:h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-600 font-medium text-xs sm:text-sm">
                      Sua pré-lista ainda está vazia.
                    </p>
                    <p className="text-[11px] sm:text-xs text-gray-400 mt-1">
                      Toque no botão de microfone acima e diga o que acabou em casa!
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {rascunhoItens.map((item, idx) => (
                      <div
                        key={`${item.termoFalado}-${idx}`}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span
                            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full text-xs font-bold flex items-center justify-center text-white shrink-0"
                            style={{ backgroundColor: color }}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-gray-800 text-sm sm:text-base break-words whitespace-normal">
                            {item.termoFalado}
                          </span>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 w-full sm:w-auto pl-8 sm:pl-0">
                          <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50">
                            <button
                              type="button"
                              onClick={() => alterarQuantidadeRascunho(idx, -1)}
                              className="p-1.5 text-gray-600 hover:text-gray-900 active:scale-95"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2 text-xs sm:text-sm font-bold text-gray-800 min-w-[2.2rem] text-center">
                              {item.quantidade}
                            </span>
                            <button
                              type="button"
                              onClick={() => alterarQuantidadeRascunho(idx, 1)}
                              className="p-1.5 text-gray-600 hover:text-gray-900 active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <select
                            value={item.unidade}
                            onChange={(e) => alterarUnidadeRascunho(idx, e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-700 bg-white focus:outline-none"
                          >
                            {UNIDADES_DISPONIVEIS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() => removerItemRascunho(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors ml-auto sm:ml-0"
                            title="Remover item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Seleção do Mercado para Processar a Lista */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-bold mb-1 text-gray-800 flex items-center gap-2">
              <Store className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" style={{ color }} />
              <span>
                {modoCriacao === "voz"
                  ? "Em qual mercado você vai comprar?"
                  : "Selecione o Estabelecimento"}
              </span>
            </h2>
            <p className="text-[11px] sm:text-xs text-gray-500 mb-4">
              {modoCriacao === "voz"
                ? "O motor RAG buscará no histórico deste mercado qual produto cadastrado corresponde a cada item que você falou."
                : "Analisaremos suas notas fiscais deste estabelecimento para sugerir itens frequentes."}
            </p>

            {loadingMercados ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : mercados.length === 0 ? (
              <div className="text-center py-6 sm:py-8 bg-gray-50 rounded-xl p-4">
                <p className="text-xs sm:text-sm text-gray-600">
                  Nenhum histórico de mercado encontrado. Escaneie notas fiscais para habilitar o
                  vínculo com mercados!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {mercados.map((m) => (
                  <div
                    key={m.cnpj}
                    onClick={() => setSelectedCnpj(m.cnpj)}
                    className={`cursor-pointer border-2 rounded-xl p-3 sm:p-4 transition-all active:scale-[0.99] ${
                      selectedCnpj === m.cnpj
                        ? "shadow-md scale-[1.01] bg-gray-50/40"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    style={{ borderColor: selectedCnpj === m.cnpj ? color : undefined }}
                  >
                    <h3 className="font-semibold text-gray-800 mb-1 text-sm sm:text-base leading-tight break-words">
                      {m.nomeDepara || m.nomeOriginal}
                    </h3>
                    <p className="text-xs text-gray-500 mb-2.5 font-mono">CNPJ: {formatCnpj(m.cnpj)}</p>
                    <div className="flex items-center justify-between text-xs font-medium text-gray-500 bg-gray-50 p-2 rounded-lg">
                      <span>{m.totalNotas} notas</span>
                      <span>{m.mesesDisponiveis} meses de hist.</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {mercados.length > 0 && (
              <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-gray-100 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
                {modoCriacao === "voz" ? (
                  <>
                    <label className="flex items-start sm:items-center gap-2.5 text-xs sm:text-sm text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={incluirSugestoesRecorrentes}
                        onChange={(e) => setIncluirSugestoesRecorrentes(e.target.checked)}
                        className="w-4 h-4 rounded text-green-600 focus:ring-0 shrink-0 mt-0.5 sm:mt-0"
                      />
                      <span>
                        Incluir também produtos recorrentes deste mercado que não citei por voz
                      </span>
                    </label>

                    <button
                      onClick={handleProcessarRagNoMercado}
                      disabled={!selectedCnpj || rascunhoItens.length === 0}
                      className="w-full md:w-auto px-5 sm:px-7 py-3 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
                      style={{
                        background: `linear-gradient(135deg, ${secondaryColor}, ${color})`,
                      }}
                    >
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                      <span>Processar Lista no Mercado (RAG)</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 w-full">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                        Analisar últimos {periodoMeses} meses
                      </label>
                      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1">
                        {[1, 2, 3, 4, 5, 6].map((m) => (
                          <button
                            key={m}
                            onClick={() => setPeriodoMeses(m)}
                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full font-medium transition-colors shrink-0 text-xs sm:text-sm ${
                              periodoMeses === m
                                ? "text-white shadow-sm"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                            style={{
                              backgroundColor: periodoMeses === m ? color : undefined,
                            }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleGerarListaRecorrencia}
                      disabled={!selectedCnpj}
                      className="w-full md:w-auto px-6 sm:px-8 py-3 rounded-xl font-bold text-xs sm:text-sm text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-1 active:scale-95"
                      style={{
                        background: `linear-gradient(135deg, ${secondaryColor}, ${color})`,
                      }}
                    >
                      Gerar Lista por Recorrência
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between gap-2.5">
            <button
              onClick={deleteList}
              className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600 hover:text-gray-900 font-medium px-3 sm:px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200 transition-colors shrink-0 active:scale-95"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Nova Lista</span>
            </button>

            <button
              onClick={() => setShowChecked(!showChecked)}
              className="text-xs sm:text-sm font-medium text-gray-600 bg-white px-3 sm:px-4 py-2 rounded-lg shadow-sm border border-gray-200 active:scale-95 text-center"
            >
              {showChecked ? "Ocultar comprados" : "Mostrar comprados"}
            </button>
          </div>

          {/* Barra rápida para adicionar mais itens por voz na lista já gerada */}
          <div className="bg-white p-2.5 sm:p-4 rounded-xl border border-gray-100 shadow-sm flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => toggleMicrofone(true)}
              disabled={processandoVoz}
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-white shrink-0 shadow transition-all active:scale-95 ${
                isListening ? "bg-red-500 animate-pulse" : ""
              }`}
              style={{
                background: isListening
                  ? undefined
                  : `linear-gradient(135deg, ${secondaryColor}, ${color})`,
              }}
              title="Falar mais itens para esta lista"
            >
              {processandoVoz ? (
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : isListening ? (
                <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </button>

            <input
              ref={inputVozAtivaRef}
              type="text"
              value={
                isListening && interimTranscript
                  ? `${textoComandoVoz} ${interimTranscript}`.trim()
                  : textoComandoVoz
              }
              onChange={(e) => {
                setTextoComandoVoz(e.target.value);
                latestTranscriptRef.current = e.target.value;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  enviarTextoComandoVoz(textoComandoVoz, true);
                }
              }}
              placeholder="Esqueceu algo? Fale ou digite..."
              className="flex-1 min-w-0 text-xs sm:text-sm border border-gray-200 rounded-lg px-2.5 sm:px-3.5 py-2 sm:py-2.5 focus:outline-none focus:border-green-500"
            />

            <button
              type="button"
              onClick={() =>
                enviarTextoComandoVoz(
                  `${textoComandoVoz} ${interimTranscript}`.trim(),
                  true
                )
              }
              disabled={
                processandoVoz || (!textoComandoVoz.trim() && !interimTranscript.trim())
              }
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs font-bold text-white shadow-sm disabled:opacity-40 shrink-0 flex items-center justify-center gap-1 active:scale-95"
              style={{
                background: `linear-gradient(135deg, ${secondaryColor}, ${color})`,
              }}
            >
              <span className="hidden sm:inline">Adicionar c/ RAG</span>
              <Send className="w-3.5 h-3.5 sm:hidden" />
            </button>
          </div>

          {/* Cards de Resumo Compactos no Mobile */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-white p-2.5 sm:p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-gray-500 font-medium mb-0.5 sm:mb-1">Estimativa</p>
                <p className="text-sm sm:text-2xl font-bold text-gray-800 truncate">
                  {formatCurrency(lista.estimativaTotal)}
                </p>
              </div>
              <div
                className="hidden sm:flex h-12 w-12 rounded-full items-center justify-center opacity-20"
                style={{ backgroundColor: color }}
              >
                <span className="text-2xl" style={{ color: secondaryColor }}>
                  💰
                </span>
              </div>
            </div>

            <div className="bg-white p-2.5 sm:p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between">
              <div>
                <p className="text-[10px] sm:text-sm text-gray-500 font-medium mb-0.5 sm:mb-1">Total Itens</p>
                <p className="text-sm sm:text-2xl font-bold text-gray-800">{lista.itens.length}</p>
              </div>
              <div
                className="hidden sm:flex h-12 w-12 rounded-full items-center justify-center opacity-20"
                style={{ backgroundColor: color }}
              >
                <span className="text-2xl" style={{ color: secondaryColor }}>
                  📦
                </span>
              </div>
            </div>

            <div className="bg-white p-2.5 sm:p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <p className="text-[10px] sm:text-sm text-gray-500 font-medium">Comprados</p>
                <p className="text-[11px] sm:text-sm font-bold text-gray-800">
                  {lista.itens.filter((i) => i.comprado).length}/{lista.itens.length}
                </p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 sm:h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      lista.itens.length > 0
                        ? (lista.itens.filter((i) => i.comprado).length / lista.itens.length) *
                          100
                        : 0
                    }%`,
                    backgroundColor: color,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {lista.itens.length === 0 ? (
            <div className="text-center py-10 sm:py-12 bg-white rounded-xl shadow-sm border border-gray-100 px-4">
              <p className="text-base sm:text-lg text-gray-600 font-medium">Nenhum produto encontrado.</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                Adicione itens usando o microfone acima ou tente selecionar outro mercado.
              </p>
            </div>
          ) : (
            <div className="notebook-container mt-4 sm:mt-8 max-w-3xl mx-auto">
              <div className="notebook-spiral">
                {[...Array(15)].map((_, i) => (
                  <div key={i} className="notebook-ring"></div>
                ))}
              </div>
              <div className="notebook-page">
                <div className="mb-4 sm:mb-6 border-b-2 border-gray-300 pb-2 sm:pb-3 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-1">
                  <div className="min-w-0">
                    <h2 className="font-['Patrick_Hand'] text-2xl sm:text-3xl text-gray-800 tracking-wide truncate">
                      {lista.nomeEstabelecimento}
                    </h2>
                    <p className="text-[11px] sm:text-xs text-gray-500 font-sans flex items-center flex-wrap">
                      <span>Produto falado</span>
                      <ArrowRight className="inline w-3 h-3 mx-1 shrink-0" />
                      <span>Cadastrado no mercado</span>
                    </p>
                  </div>
                  <span className="font-['Patrick_Hand'] text-sm sm:text-lg text-gray-500 shrink-0">
                    {new Date(lista.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  {lista.itens
                    .map((item, index) => ({ item, index }))
                    .filter(({ item }) => showChecked || !item.comprado)
                    .map(({ item, index }) => {
                      const apelidoSalvo = getApelidoName(item.nomeOriginal);
                      const nomeFaladoOuPrincipal =
                        item.termoFalado || apelidoSalvo || item.nome;
                      const nomeCadastradoMercado =
                        item.nomeMercado ||
                        (item.origemMatch !== "SEM_HISTORICO" ? item.nomeOriginal : null);

                      return (
                        <div
                          key={index}
                          className={`notebook-item group py-2.5 transition-colors ${
                            item.comprado ? "checked bg-black/[0.02]" : "hover:bg-black/[0.02]"
                          }`}
                        >
                          <button
                            className={`notebook-checkbox shrink-0 mt-1 ${
                              item.comprado ? "checked" : ""
                            }`}
                            onClick={() => toggleItem(index)}
                            aria-label={item.comprado ? "Marcar como não comprado" : "Marcar como comprado"}
                          >
                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white opacity-0 transition-opacity" />
                          </button>

                          {/* Coluna Central: O que o usuário falou em destaque total sem cortar nenhuma palavra */}
                          <div
                            className="flex-1 min-w-0 cursor-pointer select-none py-0.5"
                            onClick={() => toggleItem(index)}
                          >
                            <div className="flex items-start gap-1.5 flex-wrap">
                              <span className="item-text font-semibold text-gray-900 text-base sm:text-lg leading-snug break-words whitespace-normal">
                                {nomeFaladoOuPrincipal}
                              </span>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setApelidoModal({
                                    open: true,
                                    nomeOriginal: item.nomeOriginal,
                                    apelido: apelidoSalvo || item.termoFalado || "",
                                  });
                                }}
                                className="opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200/60 rounded shrink-0 self-center"
                                title="Renomear apelido"
                              >
                                <Edit2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-500 hover:text-gray-700" />
                              </button>

                              {apelidoSalvo && item.termoFalado && apelidoSalvo.toLowerCase() !== item.termoFalado.toLowerCase() && (
                                <span className="text-xs text-gray-500 font-sans italic self-center">
                                  (Apelido: {apelidoSalvo})
                                </span>
                              )}
                            </div>

                            {/* Produto cadastrado correspondente no mercado (sem truncate para leitura completa) */}
                            <div className="mt-1 flex items-center flex-wrap gap-1.5">
                              {nomeCadastradoMercado ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-mono tracking-tight border break-words whitespace-normal ${
                                    item.origemMatch === "OUTRO_MERCADO"
                                      ? "bg-amber-50 text-amber-800 border-amber-200"
                                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  }`}
                                  title={
                                    item.origemMatch === "OUTRO_MERCADO"
                                      ? `Referência de outro mercado: ${item.estabelecimentoOrigem}`
                                      : `Cadastrado no mercado: ${nomeCadastradoMercado}`
                                  }
                                >
                                  <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0 opacity-70" />
                                  <span className="break-words whitespace-normal">{nomeCadastradoMercado}</span>
                                  {item.origemMatch === "OUTRO_MERCADO" &&
                                    item.estabelecimentoOrigem && (
                                      <span className="text-[9px] sm:text-[10px] font-sans font-semibold opacity-75 shrink-0">
                                        ({item.estabelecimentoOrigem})
                                      </span>
                                    )}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs font-sans bg-gray-100 text-gray-500 border border-gray-200 w-fit">
                                  Sem histórico no mercado
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quantidade e Valor Estimado */}
                          <div
                            className="flex flex-col sm:flex-row items-end sm:items-center gap-0.5 sm:gap-3 text-xs sm:text-base shrink-0 text-gray-600 item-text ml-2 sm:ml-4 select-none cursor-pointer self-start sm:self-center pt-1 sm:pt-0"
                            onClick={() => toggleItem(index)}
                          >
                            <div className="flex flex-col items-end">
                              <span className="text-right font-medium whitespace-nowrap">
                                {item.quantidade} {item.unidade}
                              </span>
                              {Boolean(item.pesoEstimadoKg && item.unidade === "UN") && (
                                <span className="text-[10px] sm:text-xs text-emerald-700 font-semibold whitespace-nowrap bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 mt-0.5" title="Cálculo baseado no peso estimado em kg no mercado">
                                  ~{item.pesoEstimadoKg! < 1 ? `${Math.round(item.pesoEstimadoKg! * 1000)}g` : `${item.pesoEstimadoKg!.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`}
                                </span>
                              )}
                            </div>
                            <span className="min-w-[3.5rem] sm:min-w-[5rem] text-right font-semibold whitespace-nowrap text-gray-800">
                              {item.valorEstimado > 0
                                ? formatCurrency(item.valorEstimado)
                                : "—"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {apelidoModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">Renomear Produto</h3>
                <button
                  onClick={() =>
                    setApelidoModal({ open: false, nomeOriginal: "", apelido: "" })
                  }
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4 sm:mb-5 bg-gray-50 p-3 sm:p-4 rounded-xl border border-gray-100">
                <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Nome Cadastrado na Nota do Mercado
                </p>
                <p className="font-mono text-xs sm:text-sm text-gray-700 break-words">
                  {apelidoModal.nomeOriginal}
                </p>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700">
                  Como você chama este produto?
                </label>
                <input
                  type="text"
                  value={apelidoModal.apelido}
                  onChange={(e) =>
                    setApelidoModal((prev) => ({ ...prev, apelido: e.target.value }))
                  }
                  placeholder="Ex: Leite Integral, Macarrão Penne..."
                  className="w-full border-2 border-gray-200 rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm focus:outline-none focus:border-green-500 transition-colors"
                  autoFocus
                />
              </div>
            </div>

            <div className="bg-gray-50 p-3.5 sm:p-4 flex justify-end gap-2.5 sm:gap-3 border-t border-gray-100">
              <button
                onClick={() =>
                  setApelidoModal({ open: false, nomeOriginal: "", apelido: "" })
                }
                className="px-4 sm:px-5 py-2 font-medium text-xs sm:text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveApelido}
                disabled={!apelidoModal.apelido.trim()}
                className="px-4 sm:px-5 py-2 font-bold text-xs sm:text-sm text-white rounded-lg shadow-md disabled:opacity-50 transition-all hover:-translate-y-0.5 active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${secondaryColor}, ${color})`,
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
