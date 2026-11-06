'use client'

import { NotaFiscalResponse } from '@/interface/NotaFiscal/INotaFiscal'
import { useMemo, useState, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { getAccessToken, getAuthHeaders } from '@/lib/auth-api'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  ACTIONS,
  EventData,
  EVENTS,
  Joyride,
  STATUS,
  Step,
} from 'react-joyride'
import {
  Camera,
  ImagePlus,
  Link2,
  Barcode,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ScanLine,
  CreditCard,
  Landmark,
  Pencil,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShoppingBag,
  ArrowRight,
  Check,
  X,
  Activity,
  Clock,
  ClipboardList,
  FileText,
} from 'lucide-react'
import { ModalEditarNotaFiscal } from '@/components/ModalEditarNotaFiscal'

const Scanner = dynamic(
  () => import('@yudiel/react-qr-scanner').then((mod) => mod.Scanner),
  { ssr: false },
)

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

type ModoScanner =
  | 'selecao'
  | 'camera'
  | 'imagem'
  | 'url'
  | 'chave'
  | 'resumo-lote'
  | 'lote-manual'

export interface TracePasso {
  titulo: string
  horario: string
  status: 'pendente' | 'em_andamento' | 'sucesso' | 'erro'
  detalhe?: string
}

export interface ItemLoteNota {
  id: string
  rawCode: string
  tipo: 'url' | 'chave'
  status: 'processando' | 'sucesso' | 'erro'
  hora: string
  nota?: NotaFiscalResponse
  erro?: string
  etapaAtual?: number
  trace?: TracePasso[]
}

function playBeep(tipo: 'scan' | 'sucesso' | 'erro') {
  if (typeof window === 'undefined') return
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    if (tipo === 'scan') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(659.25, now) // E5
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
      osc.start(now)
      osc.stop(now + 0.12)
    } else if (tipo === 'sucesso') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now) // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08) // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16) // G5
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
      osc.start(now)
      osc.stop(now + 0.28)
    } else {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, now) // A3
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
      osc.start(now)
      osc.stop(now + 0.25)
    }
  } catch {
    // Silencia qualquer restrição de áudio do navegador
  }
}

function triggerVibrate(pattern: number | number[] = 80) {
  if (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.vibrate
  ) {
    try {
      navigator.vibrate(pattern)
    } catch {
      // Ignora erro de vibração
    }
  }
}

export function EscanearCupom() {
  const [conteudoLido, setConteudoLido] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [urlManual, setUrlManual] = useState('')
  const [chaveManual, setChaveManual] = useState('')
  const [modo, setModo] = useState<ModoScanner>('selecao')
  const [carregandoImagem, setCarregandoImagem] = useState(false)
  const [processando, setProcessando] = useState(false)
  const [notaProcessada, setNotaProcessada] =
    useState<NotaFiscalResponse | null>(null)
  const [rodandoTour, setRodandoTour] = useState(false)
  const [passoTour, setPassoTour] = useState(0)
  /** Indica que a nota veio via chave (barcode) e não via URL */
  const [processadoViaChave, setProcessadoViaChave] = useState(false)
  const [modalEditarAberto, setModalEditarAberto] = useState(false)
  const [notaEmEdicao, setNotaEmEdicao] = useState<NotaFiscalResponse | null>(null)

  /* ── Estado do Trace e Carregamento ──────────────────────────── */
  const [passoIndividual, setPassoIndividual] = useState<number>(1)
  const [tempoIndividualSegundos, setTempoIndividualSegundos] = useState<number>(0)
  const [loteManualTexto, setLoteManualTexto] = useState<string>('')
  const [expandirTraceId, setExpandirTraceId] = useState<string | null>(null)
  const timerIndividualRef = useRef<NodeJS.Timeout | null>(null)

  /* ── Estado do Modo Contínuo (Escaneamento em lote) ──────────── */
  const [modoContinuo, setModoContinuo] = useState(true)
  const [itensLote, setItensLote] = useState<ItemLoteNota[]>([])
  const [flashCaptura, setFlashCaptura] = useState(false)
  const [avisoTemporario, setAvisoTemporario] = useState<string | null>(null)
  const [expandirId, setExpandirId] = useState<string | null>(null)

  const ultimoScanRef = useRef<{ raw: string; time: number } | null>(null)
  const avisoTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const totalNotasLoteSucesso = useMemo(
    () => itensLote.filter((item) => item.status === 'sucesso'),
    [itensLote],
  )

  const totalValorLote = useMemo(
    () =>
      totalNotasLoteSucesso.reduce(
        (acc, item) => acc + (item.nota?.valorTotal || 0),
        0,
      ),
    [totalNotasLoteSucesso],
  )

  const totalProdutosLote = useMemo(
    () =>
      totalNotasLoteSucesso.reduce(
        (acc, item) => acc + (item.nota?.produtos?.length || 0),
        0,
      ),
    [totalNotasLoteSucesso],
  )

  const totalProcessando = useMemo(
    () => itensLote.filter((item) => item.status === 'processando').length,
    [itensLote],
  )

  const totalErros = useMemo(
    () => itensLote.filter((item) => item.status === 'erro').length,
    [itensLote],
  )

  const exibirAviso = (msg: string) => {
    setAvisoTemporario(msg)
    if (avisoTimeoutRef.current) clearTimeout(avisoTimeoutRef.current)
    avisoTimeoutRef.current = setTimeout(() => {
      setAvisoTemporario(null)
    }, 3500)
  }

  const passosTour = useMemo<Step[]>(
    () => [
      {
        target: '[data-tour="modos-escanear"]',
        content:
          'Aqui você escolhe como quer capturar o cupom: câmera, foto, URL manual ou chave de acesso.',
        placement: 'bottom',
        disableBeacon: true,
      },
      {
        target: '[data-tour="toggle-continuo"]',
        content:
          'Com o Modo Contínuo ativado, você pode escanear vários cupons em sequência sem precisar fechar a câmera!',
      },
      {
        target: '[data-tour="modo-camera"]',
        content:
          'Câmera: leitura ao vivo de QR code e também do código de barras da chave de acesso.',
      },
      {
        target: '[data-tour="modo-imagem"]',
        content:
          'Enviar foto: use uma imagem salva que já contenha o QR code do cupom fiscal.',
      },
      {
        target: '[data-tour="modo-url"]',
        content:
          'URL manual: cole o link da NFC-e quando preferir ou não conseguir escanear.',
      },
      {
        target: '[data-tour="modo-chave"]',
        content:
          'Código de barras: consulte pela chave de acesso numérica com 44 dígitos.',
      },
    ],
    [],
  )

  const recomecar = () => {
    setConteudoLido(null)
    setErro(null)
    setNotaProcessada(null)
    setModo('selecao')
    setUrlManual('')
    setChaveManual('')
    setProcessadoViaChave(false)
  }

  const limparSessaoLote = () => {
    setItensLote([])
    setAvisoTemporario(null)
    ultimoScanRef.current = null
  }

  const iniciarTour = () => {
    if (modo !== 'selecao' || conteudoLido || notaProcessada) {
      recomecar()
      setTimeout(() => {
        setPassoTour(0)
        setRodandoTour(true)
      }, 0)
      return
    }

    setPassoTour(0)
    setRodandoTour(true)
  }

  const onJoyrideCallback = (data: EventData) => {
    const { action, index, status, type } = data

    if (
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED ||
      action === ACTIONS.CLOSE
    ) {
      setRodandoTour(false)
      setPassoTour(0)
      return
    }

    if (type === EVENTS.TARGET_NOT_FOUND) {
      setPassoTour(index + 1)
      return
    }

    if (type === EVENTS.STEP_AFTER) {
      setPassoTour(index + (action === ACTIONS.PREV ? -1 : 1))
    }
  }

  /* ── Processar item do lote em segundo plano com Trace ────────── */
  const processarItemLote = async (
    id: string,
    rawCode: string,
    tipo: 'url' | 'chave',
  ) => {
    const horaInicio = new Date().toLocaleTimeString('pt-BR')
    const traceInicial: TracePasso[] = [
      {
        titulo: 'Registro na fila de processamento',
        horario: horaInicio,
        status: 'sucesso',
        detalhe: tipo === 'chave' ? `Chave: ${rawCode}` : `URL: ${rawCode.slice(0, 50)}...`,
      },
      {
        titulo: 'Conexão com portal SEFAZ Estadual',
        horario: horaInicio,
        status: 'em_andamento',
        detalhe: 'Aguardando retorno do webservice estadual...',
      },
      {
        titulo: 'Extração e categorização de produtos',
        horario: '',
        status: 'pendente',
      },
      {
        titulo: 'Gravando no banco e catálogo de preços',
        horario: '',
        status: 'pendente',
      },
    ]

    setItensLote((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'processando', trace: traceInicial, etapaAtual: 2 } : item,
      ),
    )

    try {
      const token = getAccessToken()
      if (!token) {
        throw new Error('Faça login para processar notas fiscais.')
      }

      let response: Response
      if (tipo === 'chave') {
        response = await fetch(`${API_URL}/notas-fiscais/processar-chave`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ chaveAcesso: rawCode }),
        })
      } else {
        response = await fetch(`${API_URL}/notas-fiscais/processar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ url: rawCode }),
        })
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Erro ${response.status}`)
      }

      const nota: NotaFiscalResponse = await response.json()
      const horaFim = new Date().toLocaleTimeString('pt-BR')

      const traceFinal: TracePasso[] = [
        {
          titulo: 'Registro na fila de processamento',
          horario: horaInicio,
          status: 'sucesso',
          detalhe: tipo === 'chave' ? `Chave: ${rawCode}` : `URL: ${rawCode.slice(0, 50)}...`,
        },
        {
          titulo: 'Conexão com portal SEFAZ Estadual',
          horario: horaFim,
          status: 'sucesso',
          detalhe: `NFC-e #${nota.numero || 'N/A'} autorizada pela SEFAZ`,
        },
        {
          titulo: 'Extração e categorização de produtos',
          horario: horaFim,
          status: 'sucesso',
          detalhe: `${nota.produtos?.length || 0} produto(s) identificados e categorizados`,
        },
        {
          titulo: 'Gravando no banco e catálogo de preços',
          horario: horaFim,
          status: 'sucesso',
          detalhe: `Salvo em ${nota.estabelecimento || 'Estabelecimento'} • Total: R$ ${nota.valorTotal?.toFixed(2)}`,
        },
      ]

      playBeep('sucesso')
      triggerVibrate([80, 50, 120])
      setItensLote((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: 'sucesso', nota, trace: traceFinal, etapaAtual: 4 }
            : item,
        ),
      )
    } catch (e) {
      console.error('Erro ao processar item do lote:', e)
      playBeep('erro')
      triggerVibrate([200, 100, 200])
      const msg = e instanceof Error ? e.message : 'Falha ao processar nota fiscal'
      const horaErro = new Date().toLocaleTimeString('pt-BR')

      const traceComErro: TracePasso[] = [
        {
          titulo: 'Registro na fila de processamento',
          horario: horaInicio,
          status: 'sucesso',
          detalhe: tipo === 'chave' ? `Chave: ${rawCode}` : `URL: ${rawCode.slice(0, 50)}...`,
        },
        {
          titulo: 'Conexão com portal SEFAZ Estadual',
          horario: horaErro,
          status: 'erro',
          detalhe: msg,
        },
      ]

      setItensLote((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: 'erro', erro: msg, trace: traceComErro, etapaAtual: 2 }
            : item,
        ),
      )
    }
  }

  /* ── Reprocessar todos os itens com erro no lote ────────────── */
  const reprocessarTodosComErro = () => {
    const itensComErro = itensLote.filter((i) => i.status === 'erro')
    itensComErro.forEach((item) => {
      reprocessarItemLote(item)
    })
  }

  /* ── Reprocessar um item com erro no lote ───────────────────── */
  const reprocessarItemLote = (item: ItemLoteNota) => {
    setItensLote((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, status: 'processando', erro: undefined } : i,
      ),
    )
    processarItemLote(item.id, item.rawCode, item.tipo)
  }

  /* ── Remover item do lote ────────────────────────────────────── */
  const removerItemLote = (id: string) => {
    setItensLote((prev) => prev.filter((i) => i.id !== id))
  }

  /* ── Iniciar e Parar Timer de Processamento Individual ──────── */
  const iniciarTimerTraceIndividual = () => {
    setPassoIndividual(1)
    setTempoIndividualSegundos(0)
    if (timerIndividualRef.current) clearInterval(timerIndividualRef.current)

    const start = Date.now()
    timerIndividualRef.current = setInterval(() => {
      const decorrido = Math.floor((Date.now() - start) / 1000)
      setTempoIndividualSegundos(decorrido)
      if (decorrido >= 1 && decorrido < 3) {
        setPassoIndividual(2)
      } else if (decorrido >= 3 && decorrido < 6) {
        setPassoIndividual(3)
      } else if (decorrido >= 6) {
        setPassoIndividual(4)
      }
    }, 1000)
  }

  const finalizarTimerTraceIndividual = () => {
    if (timerIndividualRef.current) {
      clearInterval(timerIndividualRef.current)
      timerIndividualRef.current = null
    }
  }

  /* ── Processar nota individual por URL ───────────────────────── */
  const enviarParaProcessar = async () => {
    if (!conteudoLido) return

    setProcessando(true)
    setErro(null)
    iniciarTimerTraceIndividual()
    try {
      const token = getAccessToken()
      if (!token) {
        throw new Error('Faça login para processar notas fiscais.')
      }
      const response = await fetch(`${API_URL}/notas-fiscais/processar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ url: conteudoLido }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Erro ${response.status}`)
      }

      setPassoIndividual(5)
      const nota: NotaFiscalResponse = await response.json()
      setNotaProcessada(nota)
      playBeep('sucesso')
    } catch (e) {
      console.error('Erro ao processar nota:', e)
      playBeep('erro')
      setErro(e instanceof Error ? e.message : 'Erro ao processar nota fiscal')
    } finally {
      finalizarTimerTraceIndividual()
      setProcessando(false)
    }
  }

  /* ── Processar nota individual por Chave de Acesso ──────────── */
  const enviarChaveParaProcessar = async (chave?: string) => {
    const chaveAcesso = (chave || chaveManual).replace(/\D/g, '').trim()

    if (!chaveAcesso || chaveAcesso.length !== 44) {
      setErro('A chave de acesso deve conter exatamente 44 dígitos numéricos.')
      return
    }

    setProcessando(true)
    setErro(null)
    iniciarTimerTraceIndividual()
    try {
      const token = getAccessToken()
      if (!token) {
        throw new Error('Faça login para processar notas fiscais.')
      }
      const response = await fetch(
        `${API_URL}/notas-fiscais/processar-chave`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ chaveAcesso }),
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Erro ${response.status}`)
      }

      setPassoIndividual(5)
      const nota: NotaFiscalResponse = await response.json()
      setNotaProcessada(nota)
      setProcessadoViaChave(true)
      setConteudoLido(chaveAcesso)
      playBeep('sucesso')
    } catch (e) {
      console.error('Erro ao processar via chave:', e)
      playBeep('erro')
      setErro(
        e instanceof Error
          ? e.message
          : 'Erro ao processar nota via chave de acesso',
      )
    } finally {
      finalizarTimerTraceIndividual()
      setProcessando(false)
    }
  }

  const enviarUrlManual = () => {
    const url = urlManual.trim()
    if (url) {
      setConteudoLido(url)
      setModo('selecao')
      setErro(null)
    }
  }

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const filesList = event.target.files
    if (!filesList || filesList.length === 0) return

    const files = Array.from(filesList)
    setCarregandoImagem(true)
    setErro(null)

    // Se selecionou apenas 1 imagem e não está em modo contínuo, carrega para revisão individual
    if (files.length === 1 && !modoContinuo) {
      try {
        const scanner = new Html5Qrcode('qr-reader-hidden', { verbose: false })
        const result = await scanner.scanFileV2(files[0], true)
        setConteudoLido(result.decodedText)
        setErro(null)
        setModo('selecao')
      } catch (e) {
        console.error('Erro ao ler imagem:', e)
        setErro(
          'Não foi possível ler o QR code da imagem. Tente uma foto com melhor qualidade ou use a opção manual.',
        )
      } finally {
        setCarregandoImagem(false)
        event.target.value = ''
      }
      return
    }

    // Processamento em lote de múltiplas imagens
    try {
      const scanner = new Html5Qrcode('qr-reader-hidden', { verbose: false })
      let lidos = 0

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const novoId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${i}-${Math.random()}`
        const hora = new Date().toLocaleTimeString('pt-BR')

        try {
          const result = await scanner.scanFileV2(file, true)
          const value = result.decodedText.trim()
          const apenasDigitos = value.replace(/\D/g, '')
          const isChave = /^\d{44}$/.test(apenasDigitos)
          const rawFinal = isChave ? apenasDigitos : value
          const tipo: 'url' | 'chave' = isChave ? 'chave' : 'url'

          const novoItem: ItemLoteNota = {
            id: novoId,
            rawCode: rawFinal,
            tipo,
            status: 'processando',
            hora,
          }

          setItensLote((prev) => [novoItem, ...prev])
          processarItemLote(novoId, rawFinal, tipo)
          lidos++
        } catch {
          const itemFalha: ItemLoteNota = {
            id: novoId,
            rawCode: file.name,
            tipo: 'url',
            status: 'erro',
            hora,
            erro: `Não foi possível ler QR code no arquivo "${file.name}"`,
            trace: [
              {
                titulo: `Upload do arquivo: ${file.name}`,
                horario: hora,
                status: 'erro',
                detalhe: 'A imagem não contém um QR Code nítido ou a resolução é insuficiente.',
              },
            ],
          }
          setItensLote((prev) => [itemFalha, ...prev])
        }
      }

      setModo('resumo-lote')
      exibirAviso(`📸 ${lidos} cupom(ns) identificado(s) de ${files.length} foto(s)!`)
    } catch (err) {
      console.error('Erro ao ler imagens em lote:', err)
      setErro('Erro ao processar as fotos selecionadas.')
    } finally {
      setCarregandoImagem(false)
      event.target.value = ''
    }
  }

  /* ── Iniciar Processamento Manual em Lote (URLs / Chaves coladas) */
  const processarLoteManual = () => {
    if (!loteManualTexto.trim()) return

    const linhas = loteManualTexto
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter(Boolean)

    if (linhas.length === 0) {
      setErro('Insira pelo menos uma URL ou chave de acesso válida.')
      return
    }

    let adicionados = 0
    linhas.forEach((linha, idx) => {
      const apenasDigitos = linha.replace(/\D/g, '')
      const isChave = /^\d{44}$/.test(apenasDigitos)
      const rawFinal = isChave ? apenasDigitos : linha
      const tipo: 'url' | 'chave' = isChave ? 'chave' : 'url'

      const novoId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${idx}-${Math.random()}`

      const novoItem: ItemLoteNota = {
        id: novoId,
        rawCode: rawFinal,
        tipo,
        status: 'processando',
        hora: new Date().toLocaleTimeString('pt-BR'),
      }

      setItensLote((prev) => [novoItem, ...prev])
      processarItemLote(novoId, rawFinal, tipo)
      adicionados++
    })

    setLoteManualTexto('')
    setModo('resumo-lote')
    exibirAviso(`🚀 ${adicionados} notas adicionadas ao lote!`)
  }

  /** Handler de leitura da câmera (modo contínuo ou individual) */
  const handleScan = (detectedCodes: { rawValue?: string }[]) => {
    const value = detectedCodes?.[0]?.rawValue?.trim()
    if (!value) return

    const agora = Date.now()

    // ── MODO CONTÍNUO (Lote) ──
    if (modoContinuo) {
      // Previne disparos repetidos consecutivos do mesmo código no curto intervalo
      if (
        ultimoScanRef.current &&
        ultimoScanRef.current.raw === value &&
        agora - ultimoScanRef.current.time < 3000
      ) {
        return
      }

      ultimoScanRef.current = { raw: value, time: agora }

      const apenasDigitos = value.replace(/\D/g, '')
      const isChave = /^\d{44}$/.test(apenasDigitos)
      const rawFinal = isChave ? apenasDigitos : value
      const tipo: 'url' | 'chave' = isChave ? 'chave' : 'url'

      // Verifica se já foi escaneado no lote atual
      const jaExiste = itensLote.some(
        (i) =>
          i.rawCode === rawFinal ||
          (i.nota?.chaveAcesso && i.nota.chaveAcesso === rawFinal),
      )

      if (jaExiste) {
        triggerVibrate([40, 40])
        exibirAviso('⚠️ Este cupom já foi escaneado nesta sessão!')
        return
      }

      // Feedback de captura bem-sucedida
      setFlashCaptura(true)
      setTimeout(() => setFlashCaptura(false), 350)
      playBeep('scan')
      triggerVibrate(80)
      exibirAviso('✨ Cupom detectado! Processando dados...')

      const novoId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`

      const novoItem: ItemLoteNota = {
        id: novoId,
        rawCode: rawFinal,
        tipo,
        status: 'processando',
        hora: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      }

      setItensLote((prev) => [novoItem, ...prev])
      processarItemLote(novoId, rawFinal, tipo)
      return
    }

    // ── MODO INDIVIDUAL PADRÃO ──
    const apenasDigitos = value.replace(/\D/g, '')
    if (/^\d{44}$/.test(apenasDigitos)) {
      setChaveManual(apenasDigitos)
      setModo('chave')
      setConteudoLido(null)
      return
    }

    setConteudoLido(value)
    setErro(null)
  }

  const abrirEdicaoNota = (nota: NotaFiscalResponse) => {
    setNotaEmEdicao(nota)
    setModalEditarAberto(true)
  }

  const renderCardTraceIndividual = () => (
    <div className="mt-5 p-5 bg-white border border-emerald-200 rounded-2xl shadow-md animate-fadeIn text-left">
      <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
            <Activity className="h-5 w-5 animate-pulse text-emerald-700" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">
              Acompanhamento do Processamento
            </h4>
            <p className="text-xs text-gray-500">
              Executando etapas de extração e validação fiscal
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-mono font-semibold bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg">
          <Clock className="h-3.5 w-3.5 text-gray-500" />
          <span>{tempoIndividualSegundos}s</span>
        </div>
      </div>

      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-emerald-600 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, (passoIndividual / 5) * 100)}%` }}
        />
      </div>

      <div className="space-y-2.5">
        {[
          { passo: 1, label: '1. Validação de formato da chave / URL' },
          { passo: 2, label: '2. Conexão com portal SEFAZ Estadual' },
          { passo: 3, label: '3. Extração dos produtos, valores e tributos' },
          { passo: 4, label: '4. Higienização e categorização inteligente' },
          { passo: 5, label: '5. Gravação no histórico e catálogo de preços' },
        ].map((etapa) => {
          const isConcluido = passoIndividual > etapa.passo
          const isAtivo = passoIndividual === etapa.passo
          return (
            <div key={etapa.passo} className="flex items-center gap-3 text-xs sm:text-sm">
              <div className="shrink-0">
                {isConcluido ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : isAtivo ? (
                  <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
              </div>
              <span
                className={
                  isConcluido
                    ? 'text-gray-700 font-medium'
                    : isAtivo
                    ? 'text-amber-800 font-bold'
                    : 'text-gray-400'
                }
              >
                {etapa.label}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-gray-400 mt-4 text-center">
        💡 O tempo de resposta pode variar entre 5 a 20s de acordo com a SEFAZ estadual.
      </p>
    </div>
  )

  return (
    <div className="max-w-xl mx-auto p-4 sm:p-6 pb-24">
      <Joyride
        run={rodandoTour}
        steps={passosTour}
        stepIndex={passoTour}
        onEvent={onJoyrideCallback}
        continuous
        scrollToFirstStep
        locale={{
          back: 'Voltar',
          close: 'Fechar',
          last: 'Finalizar',
          next: 'Próximo',
          skip: 'Pular',
        }}
        options={{
          buttons: ['back', 'close', 'primary', 'skip'],
          primaryColor: '#166534',
          skipScroll: true,
          zIndex: 10000,
        }}
      />
      <div id="qr-reader-hidden" className="hidden" aria-hidden="true" />

      {/* ─── Header ────────────────────────────────────────────── */}
      <header className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
          <ScanLine className="h-3.5 w-3.5" />
          Scanner Inteligente
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          De Olho na Nota
        </h1>
        <p className="text-gray-600 text-sm mt-1 max-w-md mx-auto">
          Capture cupons fiscais em sequência ou individualmente e acompanhe o
          processamento em tempo real.
        </p>
        <button
          type="button"
          onClick={iniciarTour}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          Como funciona o leitor?
        </button>
      </header>

      {/* ─── Erro global (quando nada foi lido ainda) ─────────── */}
      {erro && !conteudoLido && modo !== 'chave' && (
        <div
          className="bg-red-50 text-red-700 p-4 rounded-xl mb-4 text-center flex flex-col items-center gap-3 border border-red-200"
          role="alert"
        >
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-sm font-medium">{erro}</p>
          <button
            type="button"
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 shadow-sm"
            onClick={recomecar}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TELA DE SELEÇÃO: modos de escanear                   */}
      {/* ═══════════════════════════════════════════════════════ */}
      {!conteudoLido && modo === 'selecao' && !erro && (
        <div className="flex flex-col gap-5">
          {/* Banner de Alternância do Modo Contínuo */}
          <div
            data-tour="toggle-continuo"
            className="p-4 rounded-2xl border-2 transition-all bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border-emerald-300 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">
                      Modo Contínuo (Vários cupons)
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900 uppercase">
                      Novo
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Escaneie cupom atrás de cupom sem fechar a câmera
                  </p>
                </div>
              </div>

              {/* Toggle switch visual */}
              <button
                type="button"
                role="switch"
                aria-checked={modoContinuo}
                onClick={() => setModoContinuo((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${
                  modoContinuo ? 'bg-emerald-600' : 'bg-gray-300'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    modoContinuo ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {itensLote.length > 0 && (
              <div className="mt-3 pt-3 border-t border-emerald-200/60 flex items-center justify-between text-xs">
                <span className="text-emerald-800 font-medium">
                  {itensLote.length} cupom(ns) na sessão anterior
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModo('resumo-lote')}
                    className="text-emerald-700 hover:text-emerald-900 font-semibold underline"
                  >
                    Ver resumo ({itensLote.length})
                  </button>
                  <button
                    type="button"
                    onClick={limparSessaoLote}
                    className="text-gray-400 hover:text-red-600"
                    title="Limpar sessão"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            )}
          </div>

          <div
            className="grid grid-cols-2 gap-3.5 w-full"
            data-tour="modos-escanear"
          >
            {/* Câmera */}
            <button
              type="button"
              data-tour="modo-camera"
              className="flex flex-col items-center gap-2.5 p-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 hover:border-emerald-500 hover:bg-emerald-100/70 transition-all group shadow-sm text-center relative overflow-hidden"
              onClick={() => setModo('camera')}
            >
              {modoContinuo && (
                <div className="absolute top-2 right-2 bg-emerald-600 text-white rounded-full p-1 shadow-sm">
                  <Layers className="h-3 w-3" />
                </div>
              )}
              <div className="p-3 bg-white rounded-xl shadow-sm text-emerald-700 group-hover:scale-110 transition-transform">
                <Camera className="h-7 w-7" />
              </div>
              <div>
                <span className="block text-sm font-semibold text-emerald-900">
                  {modoContinuo ? 'Câmera Contínua' : 'Câmera'}
                </span>
                <span className="text-xs text-emerald-700/80">
                  {modoContinuo
                    ? 'Leitura sem parar'
                    : 'Leitura de 1 cupom'}
                </span>
              </div>
            </button>

            {/* Upload imagem */}
            <label
              data-tour="modo-imagem"
              className="flex flex-col items-center gap-2.5 p-5 rounded-2xl border-2 border-teal-200 bg-teal-50/60 hover:border-teal-500 hover:bg-teal-100/70 transition-all cursor-pointer group shadow-sm text-center"
            >
              <div className="p-3 bg-white rounded-xl shadow-sm text-teal-700 group-hover:scale-110 transition-transform">
                <ImagePlus className="h-7 w-7" />
              </div>
              <div>
                <span className="block text-sm font-semibold text-teal-900">
                  {carregandoImagem ? 'Lendo...' : 'Enviar Foto'}
                </span>
                <span className="text-xs text-teal-700/80">
                  QR code em imagem
                </span>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                disabled={carregandoImagem}
                className="hidden"
              />
            </label>

            {/* URL Manual */}
            <button
              type="button"
              data-tour="modo-url"
              className="flex flex-col items-center gap-2.5 p-5 rounded-2xl border-2 border-blue-200 bg-blue-50/60 hover:border-blue-500 hover:bg-blue-100/70 transition-all group shadow-sm text-center"
              onClick={() => setModo('url')}
            >
              <div className="p-3 bg-white rounded-xl shadow-sm text-blue-700 group-hover:scale-110 transition-transform">
                <Link2 className="h-7 w-7" />
              </div>
              <div>
                <span className="block text-sm font-semibold text-blue-900">
                  URL Manual
                </span>
                <span className="text-xs text-blue-700/80">Colar link NFC-e</span>
              </div>
            </button>

            {/* Código de Barras / Chave de Acesso */}
            <button
              type="button"
              data-tour="modo-chave"
              className="flex flex-col items-center gap-2.5 p-5 rounded-2xl border-2 border-amber-200 bg-amber-50/60 hover:border-amber-500 hover:bg-amber-100/70 transition-all group shadow-sm text-center"
              onClick={() => setModo('chave')}
            >
              <div className="p-3 bg-white rounded-xl shadow-sm text-amber-700 group-hover:scale-110 transition-transform">
                <Barcode className="h-7 w-7" />
              </div>
              <div>
                <span className="block text-sm font-semibold text-amber-900">
                  Cód. de Barras
                </span>
                <span className="text-xs text-amber-700/80">
                  Chave 44 dígitos
                </span>
              </div>
            </button>

            {/* Colar Múltiplas Notas em Lote */}
            <button
              type="button"
              className="col-span-2 flex items-center justify-between p-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50/70 hover:border-indigo-500 hover:bg-indigo-100/80 transition-all group shadow-sm text-left"
              onClick={() => setModo('lote-manual')}
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-xl shadow-sm text-indigo-700 group-hover:scale-110 transition-transform">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div>
                  <span className="block text-sm font-bold text-indigo-950">
                    Colar Múltiplas Notas (Lote)
                  </span>
                  <span className="text-xs text-indigo-700/80">
                    Cole várias URLs ou chaves de 44 dígitos de uma vez com trace
                  </span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-indigo-600 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODO: Câmera (QR Code ao vivo ou contínuo)            */}
      {/* ═══════════════════════════════════════════════════════ */}
      {modo === 'camera' && !erro && (
        <div className="flex flex-col gap-4">
          {/* Barra de controle no topo da câmera */}
          <div className="flex items-center justify-between bg-gray-900 text-white px-4 py-2.5 rounded-2xl shadow-md">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
              onClick={recomecar}
            >
              ← Voltar
            </button>

            {/* Toggle contínuo dentro da câmera */}
            <button
              type="button"
              onClick={() => setModoContinuo((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                modoContinuo
                  ? 'bg-emerald-500 text-gray-950 shadow-sm ring-2 ring-emerald-400/50'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              {modoContinuo ? 'Modo Contínuo: LIGADO' : 'Modo Contínuo: DESLIGADO'}
            </button>

            {modoContinuo && itensLote.length > 0 && (
              <button
                type="button"
                onClick={() => setModo('resumo-lote')}
                className="text-xs bg-emerald-700 hover:bg-emerald-600 px-2.5 py-1 rounded-lg font-medium transition-colors"
              >
                Resumo ({itensLote.length})
              </button>
            )}
          </div>

          {/* Viewfinder da Câmera */}
          <div
            className={`relative w-full rounded-2xl overflow-hidden bg-black transition-all duration-300 shadow-xl border-4 ${
              flashCaptura
                ? 'border-emerald-400 scale-[1.01] ring-4 ring-emerald-400/40'
                : 'border-gray-800'
            }`}
          >
            <Scanner
              onScan={handleScan}
              onError={() => {
                setErro(
                  'Não foi possível acessar a câmera. Verifique permissões do navegador.',
                )
              }}
              paused={!modoContinuo && (!!conteudoLido || !!erro)}
              constraints={{ facingMode: 'environment' }}
              components={{ finder: true }}
              classNames={{
                container: 'w-full h-72 sm:h-80 bg-black',
                video: 'w-full h-full object-cover',
              }}
            />

            {/* Overlay com instrução e aviso */}
            <div className="absolute top-3 left-3 right-3 flex flex-col items-center gap-2 pointer-events-none">
              {avisoTemporario ? (
                <div className="bg-emerald-900/90 text-white text-xs px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md animate-fade-in flex items-center gap-1.5 border border-emerald-400/30">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-300" />
                  <span>{avisoTemporario}</span>
                </div>
              ) : (
                <div className="bg-black/60 text-gray-200 text-[11px] px-3 py-1 rounded-full backdrop-blur-sm">
                  {modoContinuo
                    ? 'Aponte para o QR code ou código de barras de cada cupom'
                    : 'Aponte para o QR code do cupom fiscal'}
                </div>
              )}
            </div>

            {flashCaptura && (
              <div className="absolute inset-0 bg-emerald-500/20 pointer-events-none animate-pulse" />
            )}
          </div>

          {/* ── PAINEL AO VIVO DE NOTAS DO LOTE (Modo Contínuo) ── */}
          {modoContinuo && (
            <div className="flex flex-col gap-3 mt-2">
              {/* Barra de métricas da sessão */}
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold text-sm border border-emerald-200">
                    {itensLote.length}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      Notas nesta sessão
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="text-emerald-700 font-semibold">
                        {totalNotasLoteSucesso.length} processada(s)
                      </span>
                      {totalProcessando > 0 && (
                        <span className="text-amber-600 font-medium flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {totalProcessando} em andamento
                        </span>
                      )}
                      {totalErros > 0 && (
                        <span className="text-red-600 font-medium">
                          {totalErros} falha(s)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-gray-500 block">Total somado</span>
                  <span className="text-base font-extrabold text-emerald-700">
                    R$ {totalValorLote.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Botões de Ação do Lote */}
              {itensLote.length > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModo('resumo-lote')}
                    className="flex-1 py-2.5 px-4 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Finalizar e ver resumo ({itensLote.length})
                  </button>
                  <button
                    type="button"
                    onClick={limparSessaoLote}
                    className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-semibold transition-colors"
                    title="Limpar todas as notas desta sessão"
                  >
                    Limpar
                  </button>
                </div>
              )}

              {/* Feed em tempo real das notas escaneadas */}
              {itensLote.length > 0 ? (
                <div className="space-y-2.5 mt-1">
                  <div className="flex items-center justify-between text-xs text-gray-500 px-1">
                    <span>Cupons capturados (mais recentes primeiro)</span>
                    <span>{itensLote.length} item(ns)</span>
                  </div>

                  {itensLote.map((item, idx) => {
                    const isExpanded = expandirId === item.id
                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                          item.status === 'sucesso'
                            ? 'bg-white border-emerald-200 shadow-sm'
                            : item.status === 'processando'
                              ? 'bg-amber-50/70 border-amber-200 shadow-sm animate-pulse'
                              : 'bg-red-50/80 border-red-200'
                        }`}
                      >
                        <div className="p-3.5 flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            {/* Ícone de status */}
                            <div className="mt-0.5 shrink-0">
                              {item.status === 'processando' && (
                                <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
                              )}
                              {item.status === 'sucesso' && (
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                              )}
                              {item.status === 'erro' && (
                                <AlertCircle className="h-5 w-5 text-red-500" />
                              )}
                            </div>

                            <div className="min-w-0">
                              {/* Título ou Estabelecimento */}
                              {item.status === 'processando' && (
                                <div>
                                  <p className="text-xs font-bold text-amber-900">
                                    Processando cupom #{itensLote.length - idx}...
                                  </p>
                                  <p className="text-[11px] text-amber-700 mt-0.5">
                                    Consultando SEFAZ e extraindo produtos...
                                  </p>
                                </div>
                              )}

                              {item.status === 'sucesso' && item.nota && (
                                <div>
                                  <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                                    {item.nota.estabelecimento || 'Estabelecimento'}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-gray-500 mt-0.5">
                                    <span>NF #{item.nota.numero}</span>
                                    <span>•</span>
                                    <span>{item.nota.produtos?.length || 0} produtos</span>
                                    <span>•</span>
                                    <span>{item.hora}</span>
                                  </div>
                                </div>
                              )}

                              {item.status === 'erro' && (
                                <div>
                                  <p className="text-xs font-bold text-red-900">
                                    Falha ao processar cupom
                                  </p>
                                  <p className="text-[11px] text-red-700 mt-0.5 break-words">
                                    {item.erro || 'Erro desconhecido'}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Valor e Ações */}
                          <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                            {item.status === 'sucesso' && item.nota && (
                              <>
                                <span className="text-sm font-extrabold text-emerald-700">
                                  R$ {item.nota.valorTotal.toFixed(2)}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandirId(isExpanded ? null : item.id)
                                    }
                                    className="p-1 text-gray-500 hover:text-emerald-700 rounded-md hover:bg-emerald-50 transition-colors"
                                    title={isExpanded ? 'Recolher' : 'Ver produtos'}
                                  >
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandirTraceId(
                                        expandirTraceId === item.id ? null : item.id,
                                      )
                                    }
                                    className={`p-1 rounded-md transition-colors ${
                                      expandirTraceId === item.id
                                        ? 'text-indigo-800 bg-indigo-100'
                                        : 'text-gray-500 hover:text-indigo-700 hover:bg-indigo-50'
                                    }`}
                                    title="Ver trace do processamento"
                                  >
                                    <Activity className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => abrirEdicaoNota(item.nota!)}
                                    className="p-1 text-emerald-800 hover:text-emerald-950 rounded-md hover:bg-emerald-100 transition-colors"
                                    title="Editar pagamento & tributos"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </>
                            )}

                            {item.status === 'erro' && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => reprocessarItemLote(item)}
                                  className="inline-flex items-center gap-1 text-[11px] bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded-md font-medium transition-colors"
                                  title="Tentar novamente"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  Tentar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removerItemLote(item.id)}
                                  className="text-red-400 hover:text-red-600 p-1"
                                  title="Remover da lista"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Dropdown de produtos expandidos */}
                        {isExpanded && item.nota && (
                          <div className="bg-gray-50 border-t border-gray-100 p-3 text-xs">
                            <div className="flex items-center justify-between text-gray-500 mb-2 font-medium">
                              <span>Lista de Itens ({item.nota.produtos.length})</span>
                              {item.nota.tipoPagamento && (
                                <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded text-[10px]">
                                  {item.nota.tipoPagamento}
                                </span>
                              )}
                            </div>
                            <ul className="max-h-48 overflow-y-auto space-y-1 divide-y divide-gray-100">
                              {item.nota.produtos.map((p, pIdx) => (
                                <li
                                  key={pIdx}
                                  className="pt-1 flex items-center justify-between text-[11px]"
                                >
                                  <span className="truncate pr-2 text-gray-800">
                                    {p.nome}
                                  </span>
                                  <span className="shrink-0 font-medium text-gray-700">
                                    {p.quantidade} {p.unidade} • R${' '}
                                    {p.valorTotal.toFixed(2)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Dropdown de Trace do item */}
                        {expandirTraceId === item.id && (
                          <div className="bg-slate-50/95 border-t border-slate-200 p-3.5 text-xs animate-fadeIn">
                            <div className="flex items-center justify-between text-slate-700 mb-2.5 font-bold">
                              <span className="flex items-center gap-1.5 text-indigo-900">
                                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                                Trace de Execução
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {item.tipo.toUpperCase()}: {item.rawCode.slice(0, 22)}...
                              </span>
                            </div>
                            <div className="relative pl-5 space-y-2.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-300">
                              {item.trace && item.trace.length > 0 ? (
                                item.trace.map((step, sIdx) => (
                                  <div key={sIdx} className="relative">
                                    <div className="absolute -left-5 top-0.5">
                                      {step.status === 'sucesso' && (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 bg-white rounded-full" />
                                      )}
                                      {step.status === 'em_andamento' && (
                                        <Loader2 className="w-4 h-4 text-amber-500 animate-spin bg-white rounded-full" />
                                      )}
                                      {step.status === 'erro' && (
                                        <AlertCircle className="w-4 h-4 text-red-500 bg-white rounded-full" />
                                      )}
                                      {step.status === 'pendente' && (
                                        <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 bg-white ml-0.5" />
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span
                                        className={`font-semibold ${
                                          step.status === 'erro'
                                            ? 'text-red-700'
                                            : step.status === 'em_andamento'
                                            ? 'text-amber-800'
                                            : 'text-slate-800'
                                        }`}
                                      >
                                        {step.titulo}
                                      </span>
                                      {step.horario && (
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          {step.horario}
                                        </span>
                                      )}
                                    </div>
                                    {step.detalhe && (
                                      <p className="text-[11px] text-slate-500 mt-0.5 break-all">
                                        {step.detalhe}
                                      </p>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p className="text-gray-400 text-xs italic">Aguardando trace...</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center p-6 bg-white border border-dashed border-gray-300 rounded-2xl">
                  <Layers className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-xs font-medium text-gray-600">
                    Nenhum cupom lido nesta sessão ainda.
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Aponte a câmera para os cupons em sequência para processá-los
                    automaticamente.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODO: RESUMO COMPLETO DO LOTE                           */}
      {/* ═══════════════════════════════════════════════════════ */}
      {modo === 'resumo-lote' && (
        <section className="bg-white rounded-2xl p-5 sm:p-6 shadow-lg border border-emerald-100">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
            <div>
              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">
                Sessão em Lote Concluída
              </span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                Resumo dos Cupons Processados
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setModo('camera')}
              className="text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
            >
              <Camera className="h-3.5 w-3.5" />
              Escanear mais
            </button>
          </div>

          {/* Ações Rápidas do Lote */}
          {totalErros > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-red-800 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>Existem {totalErros} nota(s) com erro no processamento.</span>
              </div>
              <button
                type="button"
                onClick={reprocessarTodosComErro}
                className="text-xs bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
              >
                <RefreshCw className="h-3 w-3" />
                Reprocessar Falhas
              </button>
            </div>
          )}

          {/* Cards de Métricas */}
          <div className="grid grid-cols-3 gap-2.5 mb-6 text-center">
            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3">
              <span className="text-[11px] text-emerald-800 font-medium block">
                Notas com Sucesso
              </span>
              <span className="text-lg sm:text-2xl font-extrabold text-emerald-900">
                {totalNotasLoteSucesso.length}
              </span>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3">
              <span className="text-[11px] text-emerald-800 font-medium block">
                Produtos Extraídos
              </span>
              <span className="text-lg sm:text-2xl font-extrabold text-emerald-900">
                {totalProdutosLote}
              </span>
            </div>

            <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3">
              <span className="text-[11px] text-emerald-800 font-medium block">
                Total Acumulado
              </span>
              <span className="text-sm sm:text-xl font-extrabold text-emerald-700 truncate block">
                R$ {totalValorLote.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Lista detalhada das notas da sessão */}
          <div className="space-y-3 mb-6">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Notas Fiscais Desta Sessão ({itensLote.length})
            </h3>

            {itensLote.map((item, idx) => (
              <div
                key={item.id}
                className={`p-4 rounded-xl border ${
                  item.status === 'sucesso'
                    ? 'bg-white border-gray-200 shadow-sm'
                    : item.status === 'processando'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400">
                        #{idx + 1}
                      </span>
                      {item.status === 'sucesso' && item.nota && (
                        <h4 className="text-sm font-bold text-gray-900">
                          {item.nota.estabelecimento}
                        </h4>
                      )}
                      {item.status === 'processando' && (
                        <h4 className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processando dados...
                        </h4>
                      )}
                      {item.status === 'erro' && (
                        <h4 className="text-sm font-bold text-red-800">
                          Falha ao processar
                        </h4>
                      )}
                    </div>

                    {item.status === 'sucesso' && item.nota && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                        <span>NF: {item.nota.numero}</span>
                        <span>•</span>
                        <span>{item.nota.produtos.length} itens</span>
                        {item.nota.tipoPagamento && (
                          <>
                            <span>•</span>
                            <span className="text-blue-700 font-medium">
                              {item.nota.tipoPagamento}
                            </span>
                          </>
                        )}
                      </div>
                    )}

                    {item.status === 'erro' && (
                      <p className="text-xs text-red-600 mt-1">
                        {item.erro || 'Erro desconhecido'}
                      </p>
                    )}
                  </div>

                  <div className="text-right flex flex-col items-end gap-1">
                    {item.status === 'sucesso' && item.nota && (
                      <span className="text-base font-extrabold text-emerald-700 block">
                        R$ {item.nota.valorTotal.toFixed(2)}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandirTraceId(
                            expandirTraceId === item.id ? null : item.id,
                          )
                        }
                        className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                          expandirTraceId === item.id
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        title="Ver trace da nota"
                      >
                        <Activity className="h-3 w-3 text-indigo-600" />
                        Trace
                      </button>

                      {item.status === 'sucesso' && item.nota && (
                        <button
                          type="button"
                          onClick={() => abrirEdicaoNota(item.nota!)}
                          className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Pencil className="h-3 w-3" /> Editar
                        </button>
                      )}

                      {item.status === 'erro' && (
                        <button
                          type="button"
                          onClick={() => reprocessarItemLote(item)}
                          className="text-[11px] font-semibold bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <RefreshCw className="h-3 w-3" /> Tentar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dropdown de Trace no Resumo */}
                {expandirTraceId === item.id && (
                  <div className="mt-3 pt-3 border-t border-gray-100 bg-slate-50/90 -mx-4 -mb-4 p-4 rounded-b-xl text-xs animate-fadeIn">
                    <div className="flex items-center justify-between text-slate-700 mb-2.5 font-bold">
                      <span className="flex items-center gap-1.5 text-indigo-900">
                        <Activity className="w-3.5 h-3.5 text-indigo-600" />
                        Trace de Execução da Nota
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        {item.tipo.toUpperCase()}: {item.rawCode.slice(0, 24)}...
                      </span>
                    </div>
                    <div className="relative pl-5 space-y-2.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-300">
                      {item.trace && item.trace.length > 0 ? (
                        item.trace.map((step, sIdx) => (
                          <div key={sIdx} className="relative">
                            <div className="absolute -left-5 top-0.5">
                              {step.status === 'sucesso' && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 bg-white rounded-full" />
                              )}
                              {step.status === 'em_andamento' && (
                                <Loader2 className="w-4 h-4 text-amber-500 animate-spin bg-white rounded-full" />
                              )}
                              {step.status === 'erro' && (
                                <AlertCircle className="w-4 h-4 text-red-500 bg-white rounded-full" />
                              )}
                              {step.status === 'pendente' && (
                                <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 bg-white ml-0.5" />
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span
                                className={`font-semibold ${
                                  step.status === 'erro'
                                    ? 'text-red-700'
                                    : step.status === 'em_andamento'
                                    ? 'text-amber-800'
                                    : 'text-slate-800'
                                }`}
                              >
                                {step.titulo}
                              </span>
                              {step.horario && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {step.horario}
                                </span>
                              )}
                            </div>
                            {step.detalhe && (
                              <p className="text-[11px] text-slate-500 mt-0.5 break-all">
                                {step.detalhe}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-gray-400 text-xs italic">Aguardando trace...</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Ações de rodapé do resumo */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setModo('camera')}
              className="flex-1 py-3 px-4 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Camera className="h-4 w-4" />
              Escanear mais cupons
            </button>
            <Link
              href="/notasfiscais"
              className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 text-center"
            >
              <ShoppingBag className="h-4 w-4" />
              Ir para Minhas Notas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODO: Processamento em Lote Manual (URLs / Chaves)     */}
      {/* ═══════════════════════════════════════════════════════ */}
      {modo === 'lote-manual' && (
        <div className="p-6 bg-indigo-50/70 border border-indigo-200 rounded-2xl shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                Processar Várias Notas em Lote
              </h3>
              <p className="text-xs text-indigo-700">
                Cole uma lista com múltiplos cupons (URLs ou chaves numéricas)
              </p>
            </div>
          </div>

          <p className="text-gray-600 text-xs my-3">
            Insira uma URL ou chave de 44 dígitos por linha. O sistema irá enfileirar e processar todas simultaneamente exibindo o trace de cada uma em tempo real.
          </p>

          <textarea
            rows={6}
            value={loteManualTexto}
            onChange={(e) => setLoteManualTexto(e.target.value)}
            placeholder={`https://www.fazenda.sp.gov.br/nfce/qrcode?p=...\n35231012345678000199650010000001231000001234\nhttps://...`}
            className="w-full p-3 border border-indigo-300 rounded-xl mb-3 font-mono text-xs focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 bg-white"
          />

          <div className="flex items-center justify-between text-xs text-gray-500 mb-4 px-1">
            <span>
              Itens detectados: <strong>{loteManualTexto.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean).length}</strong>
            </span>
            <button
              type="button"
              onClick={() => setLoteManualTexto('')}
              className="text-gray-400 hover:text-red-600 font-medium"
            >
              Limpar texto
            </button>
          </div>

          {erro && (
            <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>{erro}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              className="px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-sm font-medium"
              onClick={recomecar}
            >
              Voltar
            </button>
            <button
              type="button"
              className="px-5 py-2 bg-indigo-700 text-white rounded-xl hover:bg-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-semibold shadow-sm"
              onClick={processarLoteManual}
              disabled={!loteManualTexto.trim()}
            >
              <Activity className="h-4 w-4" />
              Processar {loteManualTexto.split(/[\n,;]+/).map((l) => l.trim()).filter(Boolean).length} Notas em Lote
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODO: URL Manual                                       */}
      {/* ═══════════════════════════════════════════════════════ */}
      {modo === 'url' && !conteudoLido && (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800">
              Inserir URL do cupom
            </h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Cole a URL que está no QR code do cupom fiscal:
          </p>
          <input
            type="url"
            className="w-full p-3 border border-slate-300 rounded-xl mb-4 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 bg-white"
            placeholder="https://www.nfce.fazenda.sp.gov.br/..."
            value={urlManual}
            onChange={(e) => setUrlManual(e.target.value)}
          />
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              className="px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-sm"
              onClick={recomecar}
            >
              Voltar
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-green-800 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              onClick={enviarUrlManual}
              disabled={!urlManual.trim()}
            >
              Usar esta URL
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODO: Chave de Acesso / Código de Barras               */}
      {/* ═══════════════════════════════════════════════════════ */}
      {modo === 'chave' && !notaProcessada && (
        <div className="p-6 bg-amber-50 border border-amber-200 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <ScanLine className="h-5 w-5 text-amber-600" />
            <h3 className="text-lg font-semibold text-gray-800">
              Chave de Acesso
            </h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Digite ou escaneie os 44 dígitos do código de barras do cupom
            fiscal. A consulta será feita automaticamente no site da SEFAZ.
          </p>

          <div className="relative mb-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={53}
              className="w-full p-3 pr-16 border border-amber-300 rounded-xl font-mono text-sm tracking-wider focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 bg-white"
              placeholder="3526 0349 0923 9800 1609 6549 4000 1607 9963 2146 8000"
              value={chaveManual
                .replace(/\D/g, '')
                .replace(/(\d{4})(?=\d)/g, '$1 ')}
              onChange={(e) =>
                setChaveManual(e.target.value.replace(/\D/g, '').slice(0, 44))
              }
            />
            <span
              className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium ${
                chaveManual.replace(/\D/g, '').length === 44
                  ? 'text-green-600'
                  : 'text-gray-400'
              }`}
            >
              {chaveManual.replace(/\D/g, '').length}/44
            </span>
          </div>

          {/* Barra de progresso visual */}
          <div className="h-1.5 w-full bg-gray-200 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min((chaveManual.replace(/\D/g, '').length / 44) * 100, 100)}%`,
                background:
                  chaveManual.replace(/\D/g, '').length === 44
                    ? '#16a34a'
                    : '#f59e0b',
              }}
            />
          </div>

          {erro && (
            <div
              className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 text-sm flex items-start gap-2"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{erro}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              className="px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-sm"
              onClick={recomecar}
            >
              Voltar
            </button>
            <button
              type="button"
              className="px-5 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
              onClick={() => enviarChaveParaProcessar()}
              disabled={
                processando || chaveManual.replace(/\D/g, '').length !== 44
              }
            >
              {processando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Consultando SEFAZ...
                </>
              ) : (
                <>
                  <ScanLine className="h-4 w-4" />
                  Consultar Nota
                </>
              )}
            </button>
          </div>

          {processando && renderCardTraceIndividual()}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* CONTEÚDO LIDO (Modo individual) — aguardando envio    */}
      {/* ═══════════════════════════════════════════════════════ */}
      {conteudoLido && !notaProcessada && !processadoViaChave && (
        <section className="p-6 bg-green-50 border border-green-200 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-semibold text-green-800">
              QR code lido com sucesso!
            </h2>
          </div>
          <p className="text-sm text-green-700 bg-green-100 p-3 rounded-xl break-all font-mono mb-4">
            {conteudoLido}
          </p>
          {erro && (
            <div
              className="bg-red-50 text-red-700 p-3 rounded-xl mt-3 flex items-start gap-2"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{erro}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-3 justify-center mt-4">
            <button
              type="button"
              onClick={recomecar}
              className="px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              Voltar
            </button>
            <button
              type="button"
              data-tour="botao-processar"
              className="px-4 py-2 bg-green-800 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
              onClick={enviarParaProcessar}
              disabled={processando}
            >
              {processando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                'Processar nota'
              )}
            </button>
          </div>
          {processando && renderCardTraceIndividual()}
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* NOTA PROCESSADA (Modo Individual) — resultado final   */}
      {/* ═══════════════════════════════════════════════════════ */}
      {notaProcessada && (
        <section
          className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100"
          data-tour="resultado-nota"
        >
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
            <h2 className="text-xl font-semibold text-green-600">
              Nota Fiscal Processada
            </h2>
          </div>

          {processadoViaChave && (
            <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
              <Barcode className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">
                Consultada via chave de acesso
              </p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 mb-6 p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-sm">
              <strong className="text-gray-700">Estabelecimento:</strong>{' '}
              {notaProcessada.estabelecimento}
            </p>
            <p className="text-sm">
              <strong className="text-gray-700">Número:</strong>{' '}
              {notaProcessada.numero}
            </p>
            <p className="text-sm">
              <strong className="text-gray-700">Valor Total:</strong> R${' '}
              {notaProcessada.valorTotal.toFixed(2)}
            </p>
            <p className="text-sm">
              <strong className="text-gray-700">Valor Pago:</strong> R${' '}
              {notaProcessada.valorPago.toFixed(2)}
            </p>
            <div className="text-sm flex flex-wrap items-center justify-between sm:col-span-2 pt-2 border-t border-gray-200 gap-2">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 text-xs border border-blue-200 font-medium">
                  <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                  {notaProcessada.tipoPagamento ||
                    notaProcessada.formaPagamento ||
                    'Pagamento não especificado'}
                  {notaProcessada.cartaoUsado
                    ? ` • ${notaProcessada.cartaoUsado}`
                    : ''}
                </span>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 text-xs border border-amber-200 font-medium">
                  <Landmark className="h-3.5 w-3.5 text-amber-700" />
                  {notaProcessada.valorTributos &&
                  notaProcessada.valorTributos > 0
                    ? `Tributos: R$ ${notaProcessada.valorTributos.toFixed(2)} (${((notaProcessada.valorTributos / (notaProcessada.valorTotal || 1)) * 100).toFixed(1)}%)`
                    : 'Tributos não informados'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => abrirEdicaoNota(notaProcessada)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
              >
                <Pencil className="h-3 w-3" />
                Editar pagamento & impostos
              </button>
            </div>
          </div>

          <h3 className="text-base font-medium text-gray-700 border-b border-gray-200 pb-2 mb-3">
            Produtos ({notaProcessada.produtos.length})
          </h3>
          <ul className="max-h-72 overflow-y-auto">
            {notaProcessada.produtos.map((produto, index) => (
              <li
                key={index}
                className="grid grid-cols-[1fr_auto_auto] gap-2 py-3 border-b border-gray-100 last:border-0 text-sm"
              >
                <span className="font-medium text-gray-800">
                  {produto.nome}
                </span>
                <span className="text-gray-500 text-right">
                  {produto.quantidade} {produto.unidade}
                </span>
                <span className="font-semibold text-green-600 text-right min-w-[80px]">
                  R$ {produto.valorTotal.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={recomecar}
              data-tour="recomecar"
              className="px-6 py-2.5 bg-green-800 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2 text-sm font-semibold"
            >
              <RotateCcw className="h-4 w-4" />
              Processar outro cupom
            </button>
            <Link
              href="/notasfiscais"
              className="px-5 py-2.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors text-sm font-semibold flex items-center gap-2"
            >
              <ShoppingBag className="h-4 w-4" />
              Ver Minhas Notas
            </Link>
          </div>
        </section>
      )}

      {/* ── Modal de Edição de Pagamentos e Tributos ──────────────── */}
      <ModalEditarNotaFiscal
        open={modalEditarAberto}
        onClose={() => {
          setModalEditarAberto(false)
          setNotaEmEdicao(null)
        }}
        nota={notaEmEdicao as any}
        onSalvo={(notaAtualizada) => {
          if (notaProcessada && notaProcessada._id === notaAtualizada._id) {
            setNotaProcessada((prev) =>
              prev
                ? {
                    ...prev,
                    tipoPagamento: notaAtualizada.tipoPagamento,
                    formaPagamento: notaAtualizada.formaPagamento,
                    cartaoUsado: notaAtualizada.cartaoUsado,
                    valorTributos: notaAtualizada.valorTributos,
                    tributosDetalhados: notaAtualizada.tributosDetalhados,
                  }
                : null,
            )
          }

          setItensLote((prev) =>
            prev.map((item) =>
              item.nota && item.nota._id === notaAtualizada._id
                ? {
                    ...item,
                    nota: {
                      ...item.nota,
                      tipoPagamento: notaAtualizada.tipoPagamento,
                      formaPagamento: notaAtualizada.formaPagamento,
                      cartaoUsado: notaAtualizada.cartaoUsado,
                      valorTributos: notaAtualizada.valorTributos,
                      tributosDetalhados: notaAtualizada.tributosDetalhados,
                    },
                  }
                : item,
            ),
          )
        }}
      />
    </div>
  )
}
