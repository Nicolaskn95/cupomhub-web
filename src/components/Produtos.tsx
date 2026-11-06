"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getAuthHeaders } from "@/lib/auth-api";
import type { NotaFiscal } from "@/interface/NotaFiscal/INotaFiscal";
import type {
  Produto,
  ProdutoAgrupadoResponse,
  HistoricoItemCompra,
} from "@/interface/Produto/IProduto";
import type { Categoria, Prefixo } from "@/interface/Prefixo/IPrefixo";
import { sanitizarDescricaoProduto, gerarChaveCanonica } from "@/lib/sanitizar-produto";
import { Loader } from "@/components/Loader";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  Search,
  Package,
  DollarSign,
  Hash,
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Store,
  Calendar,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Filter,
} from "lucide-react";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ─── Types ─────────────────────────────────────────────────────────

interface ProdutoOccurrence {
  produto: Produto;
  nota: NotaFiscal;
}

interface ProdutoAgrupado {
  id?: string;
  nome: string;
  nomes: string[];
  ocorrencias: ProdutoOccurrence[];
  totalGasto: number;
  totalQuantidade: number;
  vezesComprado: number;
  mediaPrecoUnitario: number;
  ultimoPreco: number;
  ultimaData: string;
  estabelecimentos: Map<string, { total: number; count: number; ultimoPreco: number }>;
  precosPorMes: Map<string, { total: number; count: number }>;
  compras: HistoricoItemCompra[];
  variacao: number | null; // % change of last price vs average
  categoria: Categoria | null;
}

// ─── Helpers ───────────────────────────────────────────────────────

function formatCurrency(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function formatMonthLabel(mesAno: string): string {
  const [ano, mes] = mesAno.split("-");
  const meses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];
  return `${meses[parseInt(mes) - 1]}/${ano}`;
}

function getCategoriaProduto(
  nomeProduto: string,
  prefixos: Prefixo[]
): Categoria | null {
  const nomeUpper = nomeProduto.toUpperCase();
  const sorted = [...prefixos].sort(
    (a, b) => b.prefixo.length - a.prefixo.length
  );
  for (const p of sorted) {
    if (nomeUpper.startsWith(p.prefixo.toUpperCase())) {
      return p.categoria;
    }
  }
  return null;
}

// ─── Component ─────────────────────────────────────────────────────

export function Produtos() {
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [prefixos, setPrefixos] = useState<Prefixo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Filters
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Selection
  const [produtoSelecionado, setProdutoSelecionado] =
    useState<ProdutoAgrupado | null>(null);

  // Ranking order
  const [rankingOrder, setRankingOrder] = useState<
    "gasto" | "frequencia" | "quantidade"
  >("gasto");

  // Search suggestions
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ─── Load data ─────────────────────────────────────────────────
  useEffect(() => {
    carregarDados();
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const carregarDados = async () => {
    try {
      const [notasRes, prefixosRes, categoriasRes] = await Promise.all([
        fetch(`${API_URL}/notas-fiscais`, { headers: getAuthHeaders() }),
        fetch(`${API_URL}/categorias/prefixos/listar`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API_URL}/categorias`),
      ]);

      if (!notasRes.ok) throw new Error("Erro ao carregar notas fiscais.");
      const notasData = (await notasRes.json()) as NotaFiscal[];
      setNotas(notasData);

      if (prefixosRes.ok) {
        setPrefixos((await prefixosRes.json()) as Prefixo[]);
      }
      if (categoriasRes.ok) {
        setCategorias((await categoriasRes.json()) as Categoria[]);
      }

      // Auto-set date range to full data span
      if (notasData.length > 0) {
        const datas = notasData.map((n) => new Date(n.dataEmissao).getTime());
        const min = new Date(Math.min(...datas));
        const max = new Date(Math.max(...datas));
        setDataInicio(
          `${min.getFullYear()}-${String(min.getMonth() + 1).padStart(2, "0")}-${String(min.getDate()).padStart(2, "0")}`
        );
        setDataFim(
          `${max.getFullYear()}-${String(max.getMonth() + 1).padStart(2, "0")}-${String(max.getDate()).padStart(2, "0")}`
        );
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setCarregando(false);
    }
  };

  // Backend grouped products
  const [produtosBackend, setProdutosBackend] = useState<ProdutoAgrupado[] | null>(null);

  const carregarProdutosAgrupados = useCallback(
    async (inicio?: string, fim?: string) => {
      try {
        const params = new URLSearchParams();
        if (inicio) params.append("dataInicio", inicio);
        if (fim) params.append("dataFim", fim);
        const qs = params.toString() ? `?${params.toString()}` : "";

        const res = await fetch(
          `${API_URL}/historico-compra/produtos-agrupados${qs}`,
          { headers: getAuthHeaders() }
        );

        if (res.ok) {
          const dados = (await res.json()) as ProdutoAgrupadoResponse[];
          if (Array.isArray(dados) && dados.length > 0) {
            const formatados: ProdutoAgrupado[] = dados.map((p) => ({
              id: p.id,
              nome: p.nome,
              nomes: p.nomes,
              ocorrencias: [],
              totalGasto: p.totalGasto,
              totalQuantidade: p.totalQuantidade,
              vezesComprado: p.vezesComprado,
              mediaPrecoUnitario: p.mediaPrecoUnitario,
              ultimoPreco: p.ultimoPreco,
              ultimaData: p.ultimaData,
              estabelecimentos: new Map(Object.entries(p.estabelecimentos || {})),
              precosPorMes: new Map(Object.entries(p.precosPorMes || {})),
              compras: p.compras || [],
              variacao: p.variacao,
              categoria: p.categoria as Categoria | null,
            }));
            setProdutosBackend(formatados);
            return;
          }
        }
      } catch (err) {
        console.warn("Fallback para agrupamento local:", err);
      }
    },
    []
  );

  useEffect(() => {
    carregarProdutosAgrupados(dataInicio, dataFim);
  }, [dataInicio, dataFim, carregarProdutosAgrupados]);

  // ─── Aggregate products with canonical key matching ────────────────────
  const produtosAgrupados = useMemo(() => {
    if (produtosBackend && produtosBackend.length > 0) {
      return produtosBackend;
    }

    // Filter notas by date range
    const notasFiltradas = notas.filter((nota) => {
      const d = new Date(nota.dataEmissao);
      if (dataInicio && d < new Date(dataInicio)) return false;
      if (dataFim) {
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59);
        if (d > fim) return false;
      }
      return true;
    });

    // Group by canonical key (EAN or token signature without market prefixes)
    const groupsMap = new Map<string, ProdutoOccurrence[]>();
    for (const nota of notasFiltradas) {
      if (!nota.produtos) continue;
      for (const produto of nota.produtos) {
        const chave = gerarChaveCanonica((produto as any).codigo, produto.nome);
        const list = groupsMap.get(chave) || [];
        list.push({ produto, nota });
        groupsMap.set(chave, list);
      }
    }

    const groups: ProdutoAgrupado[] = [];
    for (const [, group] of groupsMap.entries()) {
      const totalGasto = group.reduce(
        (acc, o) => acc + o.produto.valorTotal,
        0
      );
      const totalQuantidade = group.reduce(
        (acc, o) => acc + o.produto.quantidade,
        0
      );

      const sorted = [...group].sort(
        (a, b) =>
          new Date(b.nota.dataEmissao).getTime() -
          new Date(a.nota.dataEmissao).getTime()
      );

      const estabMap = new Map<
        string,
        { total: number; count: number; ultimoPreco: number }
      >();
      for (const o of group) {
        const key =
          (o.nota as any).estabelecimentoOriginal ||
          o.nota.estabelecimento ||
          (o.nota as any).razaoSocial ||
          "Supermercado";
        const existing = estabMap.get(key) || {
          total: 0,
          count: 0,
          ultimoPreco: 0,
        };
        existing.total += o.produto.valorTotal;
        existing.count += 1;
        existing.ultimoPreco = o.produto.valorUnitario;
        estabMap.set(key, existing);
      }

      const mesMap = new Map<string, { total: number; count: number }>();
      for (const o of group) {
        const d = new Date(o.nota.dataEmissao);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const existing = mesMap.get(key) || { total: 0, count: 0 };
        existing.total += o.produto.valorUnitario;
        existing.count += 1;
        mesMap.set(key, existing);
      }

      const mediaPreco = totalQuantidade > 0 ? totalGasto / totalQuantidade : 0;
      const ultimoPreco = sorted[0].produto.valorUnitario;
      const variacao =
        mediaPreco > 0 ? ((ultimoPreco - mediaPreco) / mediaPreco) * 100 : null;

      const nomesSanitizados = Array.from(
        new Set(group.map((o) => sanitizarDescricaoProduto(o.produto.nome)))
      );
      const mainName = nomesSanitizados[0] || "Produto sem nome";
      const cat = getCategoriaProduto(mainName, prefixos);

      const comprasDoGrupo: HistoricoItemCompra[] = group.map((o) => {
        const estabNome =
          (o.nota as any).estabelecimentoOriginal ||
          o.nota.estabelecimento ||
          (o.nota as any).razaoSocial ||
          "Supermercado";
        return {
          dataCompra: o.nota.dataEmissao,
          estabelecimento: estabNome,
          precoUnitario: o.produto.valorUnitario,
          quantidade: o.produto.quantidade,
          precoTotal: o.produto.valorTotal,
        };
      });

      groups.push({
        nome: mainName,
        nomes: nomesSanitizados,
        ocorrencias: group,
        totalGasto,
        totalQuantidade,
        vezesComprado: group.length,
        mediaPrecoUnitario: mediaPreco,
        ultimoPreco,
        ultimaData: sorted[0].nota.dataEmissao,
        estabelecimentos: estabMap,
        precosPorMes: mesMap,
        compras: comprasDoGrupo,
        variacao,
        categoria: cat,
      });
    }

    return groups.sort((a, b) => b.totalGasto - a.totalGasto);
  }, [produtosBackend, notas, prefixos, dataInicio, dataFim]);

  // ─── Filter products ──────────────────────────────────────────
  const produtosFiltrados = useMemo(() => {
    let filtered = produtosAgrupados;

    // Category filter
    if (categoriaFiltro !== "todas") {
      filtered = filtered.filter(
        (p) => p.categoria?._id === categoriaFiltro
      );
    }

    // Search filter
    if (busca.trim()) {
      const term = busca.toLowerCase().trim();
      filtered = filtered.filter((p) =>
        p.nomes.some((n) => n.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [produtosAgrupados, categoriaFiltro, busca]);

  // ─── Global stats ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalGasto = produtosFiltrados.reduce(
      (acc, p) => acc + p.totalGasto,
      0
    );
    const totalItens = produtosFiltrados.reduce(
      (acc, p) => acc + p.totalQuantidade,
      0
    );
    const produtosUnicos = produtosFiltrados.length;
    const mediaPorItem = totalItens > 0 ? totalGasto / totalItens : 0;

    return { totalGasto, totalItens, produtosUnicos, mediaPorItem };
  }, [produtosFiltrados]);

  // ─── Ranking ──────────────────────────────────────────────────
  const ranking = useMemo(() => {
    const sorted = [...produtosFiltrados];
    switch (rankingOrder) {
      case "gasto":
        sorted.sort((a, b) => b.totalGasto - a.totalGasto);
        break;
      case "frequencia":
        sorted.sort((a, b) => b.vezesComprado - a.vezesComprado);
        break;
      case "quantidade":
        sorted.sort((a, b) => b.totalQuantidade - a.totalQuantidade);
        break;
    }
    return sorted.slice(0, 20);
  }, [produtosFiltrados, rankingOrder]);

  // ─── Search suggestions ───────────────────────────────────────
  const suggestions = useMemo(() => {
    if (!busca.trim() || busca.length < 2) return [];
    const term = busca.toLowerCase();
    return produtosAgrupados
      .filter((p) => p.nomes.some((n) => n.toLowerCase().includes(term)))
      .slice(0, 8);
  }, [busca, produtosAgrupados]);

  // Selected purchase on chart click
  const [compraSelecionadaNoGrafico, setCompraSelecionadaNoGrafico] =
    useState<HistoricoItemCompra | null>(null);

  // Chronological purchases for the selected product
  const historicoComprasGrafico = useMemo(() => {
    if (!produtoSelecionado) return [];
    if (produtoSelecionado.compras && produtoSelecionado.compras.length > 0) {
      return [...produtoSelecionado.compras].sort(
        (a, b) =>
          new Date(a.dataCompra).getTime() - new Date(b.dataCompra).getTime()
      );
    }
    // Fallback based on precosPorMes
    return [...produtoSelecionado.precosPorMes.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, v]) => ({
        dataCompra: `${mes}-01`,
        estabelecimento: "Média do Período",
        precoUnitario: v.total / (v.count || 1),
        quantidade: v.count,
        precoTotal: v.total,
      }));
  }, [produtoSelecionado]);

  // When selected product changes, pre-select the most recent purchase
  useEffect(() => {
    if (historicoComprasGrafico.length > 0) {
      setCompraSelecionadaNoGrafico(
        historicoComprasGrafico[historicoComprasGrafico.length - 1]
      );
    } else {
      setCompraSelecionadaNoGrafico(null);
    }
  }, [historicoComprasGrafico]);

  // ─── Price chart data for selected product ────────────────────
  const PALETA_ESTAB = useMemo(
    () => [
      "#10b981", // verde esmeralda
      "#3b82f6", // azul
      "#f59e0b", // âmbar
      "#8b5cf6", // roxo
      "#ec4899", // rosa
      "#06b6d4", // ciano
      "#f97316", // laranja
      "#14b8a6", // teal
      "#6366f1", // índigo
    ],
    []
  );

  const mapaCoresEstabelecimentos = useMemo(() => {
    const estabs = Array.from(
      new Set(
        historicoComprasGrafico.map((c) => c.estabelecimento || "Supermercado")
      )
    );
    const mapa = new Map<string, string>();
    estabs.forEach((est, idx) => {
      mapa.set(est, PALETA_ESTAB[idx % PALETA_ESTAB.length]);
    });
    return mapa;
  }, [historicoComprasGrafico, PALETA_ESTAB]);

  const chartData = useMemo(() => {
    if (!produtoSelecionado || historicoComprasGrafico.length === 0) return null;

    const labels = historicoComprasGrafico.map((c) => formatDate(c.dataCompra));
    const data = historicoComprasGrafico.map((c) => c.precoUnitario);
    const pointColors = historicoComprasGrafico.map(
      (c) => mapaCoresEstabelecimentos.get(c.estabelecimento || "Supermercado") || "#10b981"
    );

    return {
      labels,
      datasets: [
        {
          label: "Preço Unitário",
          data,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          fill: true,
          tension: 0.25,
          pointBackgroundColor: pointColors,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 9,
          pointHoverBackgroundColor: pointColors,
        },
      ],
    };
  }, [produtoSelecionado, historicoComprasGrafico, mapaCoresEstabelecimentos]);

  // Chart options with click listener to display the purchase establishment
  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      onClick: (_event: any, elements: any[]) => {
        if (elements && elements.length > 0) {
          const idx = elements[0].index;
          if (historicoComprasGrafico[idx]) {
            setCompraSelecionadaNoGrafico(historicoComprasGrafico[idx]);
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items: any[]) => {
              const idx = items[0]?.dataIndex;
              const c = historicoComprasGrafico[idx];
              if (c) {
                return `${formatDate(c.dataCompra)} • ${c.estabelecimento}`;
              }
              return items[0]?.label || "";
            },
            label: (ctx: any) => {
              const idx = ctx.dataIndex;
              const c = historicoComprasGrafico[idx];
              if (c) {
                return [
                  `Preço unitário: ${formatCurrency(c.precoUnitario)}`,
                  `Local: ${c.estabelecimento}`,
                  `Qtd: ${c.quantidade} un • Total: ${formatCurrency(c.precoTotal)}`,
                ];
              }
              return `Preço: ${formatCurrency(ctx.raw as number)}`;
            },
          },
        },
      },
      scales: {
        y: {
          ticks: {
            callback: (v: any) => `R$ ${(v as number).toFixed(2)}`,
          },
          grid: { color: "rgba(0,0,0,0.05)" },
        },
        x: {
          grid: { display: false },
        },
      },
    };
  }, [historicoComprasGrafico]);

  // ─── Categories used in products ──────────────────────────────
  const categoriasUsadas = useMemo(() => {
    const cats = new Map<string, Categoria>();
    produtosAgrupados.forEach((p) => {
      if (p.categoria) {
        cats.set(p.categoria._id, p.categoria);
      }
    });
    return [...cats.values()];
  }, [produtosAgrupados]);

  // ─── Export CSV ───────────────────────────────────────────────
  const exportarCSV = useCallback(() => {
    const rows = [
      ["Produto", "Total Gasto", "Quantidade Total", "Vezes Comprado", "Preço Médio", "Último Preço", "Última Compra", "Categoria"],
    ];
    produtosFiltrados
      .sort((a, b) => b.totalGasto - a.totalGasto)
      .forEach((p) => {
        rows.push([
          p.nome,
          p.totalGasto.toFixed(2),
          p.totalQuantidade.toString(),
          p.vezesComprado.toString(),
          p.mediaPrecoUnitario.toFixed(2),
          p.ultimoPreco.toFixed(2),
          formatDate(p.ultimaData),
          p.categoria?.nome || "Sem categoria",
        ]);
      });

    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `produtos-de-olho-na-nota-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [produtosFiltrados]);

  // ─── Export PDF ───────────────────────────────────────────────
  const exportarPDF = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(16, 185, 129);
    doc.text("De Olho na Nota - Relatório de Produtos", 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `Gerado em ${new Date().toLocaleDateString("pt-BR")} | ${produtosFiltrados.length} produtos`,
      14,
      30
    );

    // Stats
    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.text(`Total Gasto: ${formatCurrency(stats.totalGasto)}`, 14, 40);
    doc.text(`Total de Itens: ${stats.totalItens}`, 14, 46);
    doc.text(`Média por Item: ${formatCurrency(stats.mediaPorItem)}`, 14, 52);
    doc.text(`Produtos Únicos: ${stats.produtosUnicos}`, 120, 40);

    // Table
    const tableData = produtosFiltrados
      .sort((a, b) => b.totalGasto - a.totalGasto)
      .map((p) => [
        p.nome,
        formatCurrency(p.totalGasto),
        p.vezesComprado.toString(),
        p.totalQuantidade.toFixed(1),
        formatCurrency(p.mediaPrecoUnitario),
        formatCurrency(p.ultimoPreco),
        p.categoria?.nome || "-",
      ]);

    autoTable(doc, {
      startY: 58,
      head: [
        [
          "Produto",
          "Total Gasto",
          "Compras",
          "Qtd Total",
          "Preço Médio",
          "Último Preço",
          "Categoria",
        ],
      ],
      body: tableData,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save(
      `produtos-de-olho-na-nota-${new Date().toISOString().split("T")[0]}.pdf`
    );
  }, [produtosFiltrados, stats]);

  // ─── Render helpers ───────────────────────────────────────────

  const VariacaoBadge = ({ variacao }: { variacao: number | null }) => {
    if (variacao === null) return null;
    const abs = Math.abs(variacao);
    if (abs < 1) {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          <Minus className="w-3 h-3" /> Estável
        </span>
      );
    }
    if (variacao > 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
          <ArrowUpRight className="w-3 h-3" /> +{abs.toFixed(1)}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-600 border border-green-200">
        <ArrowDownRight className="w-3 h-3" /> -{abs.toFixed(1)}%
      </span>
    );
  };

  // ─── Loading & Error ──────────────────────────────────────────

  if (carregando) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12 flex flex-col items-center justify-center">
          <Loader className="mb-4" />
          <p className="text-gray-600">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 text-red-700 p-6 rounded-lg text-center">
          <p className="mb-4">{erro}</p>
          <button
            onClick={carregarDados}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-green-800 mb-2">Produtos</h1>
        <p className="text-gray-600">
          Visão macro dos seus produtos comprados
        </p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-xs text-gray-500 font-medium">
              Total Gasto
            </span>
          </div>
          <p className="text-xl font-bold text-gray-800">
            {formatCurrency(stats.totalGasto)}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Hash className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500 font-medium">
              Itens Encontrados
            </span>
          </div>
          <p className="text-xl font-bold text-gray-800">
            {stats.totalItens.toLocaleString("pt-BR", {
              maximumFractionDigits: 0,
            })}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-xs text-gray-500 font-medium">
              Média por Item
            </span>
          </div>
          <p className="text-xl font-bold text-gray-800">
            {formatCurrency(stats.mediaPorItem)}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Package className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-xs text-gray-500 font-medium">
              Produtos Únicos
            </span>
          </div>
          <p className="text-xl font-bold text-gray-800">
            {stats.produtosUnicos}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
          {/* Search */}
          <div className="relative flex-1 w-full" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setShowSuggestions(true);
                setProdutoSelecionado(null);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Buscar produto por nome..."
              className="w-full pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 text-sm"
            />
            {busca && (
              <button
                onClick={() => {
                  setBusca("");
                  setShowSuggestions(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {suggestions.map((p, i) => (
                  <button
                    key={`${p.nome}-${i}`}
                    onClick={() => {
                      setBusca(p.nome);
                      setProdutoSelecionado(p);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-green-50 flex items-center justify-between gap-3 border-b border-gray-100 last:border-b-0 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {p.nome}
                      </p>
                      <p className="text-xs text-gray-500">
                        {p.vezesComprado}x comprado
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-green-700">
                        {formatCurrency(p.totalGasto)}
                      </p>
                      <VariacaoBadge variacao={p.variacao} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
              showFilters
                ? "bg-green-50 border-green-300 text-green-700"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {showFilters ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {/* Export buttons */}
          <div className="flex gap-2">
            <button
              onClick={exportarCSV}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              title="Exportar CSV"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={exportarPDF}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              title="Exportar PDF"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Categoria
              </label>
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              >
                <option value="todas">Todas as categorias</option>
                {categoriasUsadas.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Date from */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Data início
              </label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Data fim
              </label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Selected Product Detail */}
      {produtoSelecionado && (
        <div className="mb-8 space-y-4 animate-in fade-in duration-300">
          {/* Detail Header */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h2 className="text-xl font-bold text-gray-800">
                    {produtoSelecionado.nome}
                  </h2>
                  <VariacaoBadge variacao={produtoSelecionado.variacao} />
                </div>
                {produtoSelecionado.categoria && (
                  <span className="inline-flex text-xs px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                    {produtoSelecionado.categoria.nome}
                  </span>
                )}
                {produtoSelecionado.nomes.length > 1 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-gray-500 font-medium">Variações agrupadas:</span>
                    {produtoSelecionado.nomes.map((nome, nIdx) => (
                      <span
                        key={nIdx}
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200"
                        title="Nome fiscal unificado sob este mesmo produto"
                      >
                        {nome}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setProdutoSelecionado(null);
                  setBusca("");
                }}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Detail Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Total Gasto</p>
                <p className="text-lg font-bold text-gray-800">
                  {formatCurrency(produtoSelecionado.totalGasto)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Vezes Comprado</p>
                <p className="text-lg font-bold text-gray-800">
                  {produtoSelecionado.vezesComprado}x
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Preço Médio</p>
                <p className="text-lg font-bold text-gray-800">
                  {formatCurrency(produtoSelecionado.mediaPrecoUnitario)}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Último Preço</p>
                <p className="text-lg font-bold text-gray-800">
                  {formatCurrency(produtoSelecionado.ultimoPreco)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Quantidade Total</p>
                <p className="text-lg font-bold text-gray-800">
                  {produtoSelecionado.totalQuantidade.toLocaleString("pt-BR", {
                    maximumFractionDigits: 1,
                  })}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Última Compra</p>
                <p className="text-lg font-bold text-gray-800">
                  {formatDate(produtoSelecionado.ultimaData)}
                </p>
              </div>
            </div>
          </div>

          {/* Price History Chart */}
          {chartData && chartData.labels.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  Evolução de Preço por Compra
                </h3>
                <span className="text-xs text-gray-500">
                  {historicoComprasGrafico.length} registro(s) no período
                </span>
              </div>

              {mapaCoresEstabelecimentos.size > 1 && (
                <div className="flex flex-wrap items-center gap-2 mb-3.5 px-1 py-1.5 bg-gray-50/80 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-500 font-medium">Mercados no gráfico:</span>
                  {Array.from(mapaCoresEstabelecimentos.entries()).map(([estab, cor]) => (
                    <span
                      key={estab}
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold text-gray-700 bg-white border border-gray-200 shadow-2xs"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cor }}
                      />
                      {estab}
                    </span>
                  ))}
                </div>
              )}

              <div className="h-64">
                <Line data={chartData} options={chartOptions} />
              </div>

              {/* Informação do estabelecimento ao clicar ou selecionar data no gráfico */}
              {compraSelecionadaNoGrafico ? (
                <div className="mt-4 p-4 rounded-xl border border-blue-200 bg-blue-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                          Compra selecionada no gráfico
                        </span>
                        <span className="text-xs text-gray-500 hidden sm:inline">
                          (clique em outros pontos para alternar)
                        </span>
                      </div>
                      <p className="text-base font-bold text-gray-900 mt-1">
                        {compraSelecionadaNoGrafico.estabelecimento}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-600">
                        <span className="flex items-center gap-1 font-medium text-gray-700">
                          <Calendar className="w-3.5 h-3.5 text-gray-500" />
                          {formatDate(compraSelecionadaNoGrafico.dataCompra)}
                        </span>
                        <span>•</span>
                        <span>Quantidade: <strong>{compraSelecionadaNoGrafico.quantidade} un.</strong></span>
                        <span>•</span>
                        <span>Total da compra: <strong>{formatCurrency(compraSelecionadaNoGrafico.precoTotal)}</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="sm:text-right sm:border-l sm:border-blue-200 sm:pl-5">
                    <span className="text-xs text-gray-500 font-medium">Preço pago nesta data</span>
                    <p className="text-xl font-extrabold text-blue-700">
                      {formatCurrency(compraSelecionadaNoGrafico.precoUnitario)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-3 text-center italic">
                  💡 Clique em qualquer ponto de data no gráfico para visualizar onde e quanto você pagou.
                </p>
              )}
            </div>
          )}

          {/* Establishment Comparison */}
          {produtoSelecionado.estabelecimentos.size > 0 && (() => {
            const estabList = [...produtoSelecionado.estabelecimentos.entries()]
              .map(([estab, data]) => ({
                estab,
                data,
                avg: data.total / (data.count || 1),
              }))
              .sort((a, b) => a.avg - b.avg);

            const menor = estabList[0];
            const maior = estabList[estabList.length - 1];
            const temComparacao = estabList.length > 1;
            const diffValor = maior.avg - menor.avg;
            const diffPct = menor.avg > 0 ? (diffValor / menor.avg) * 100 : 0;
            const economiaEstimada = Math.max(
              0,
              produtoSelecionado.totalGasto - menor.avg * produtoSelecionado.totalQuantidade
            );

            return (
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Store className="w-5 h-5 text-blue-600" />
                    Comparativo entre Estabelecimentos
                  </h3>
                  {temComparacao && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5 self-start sm:self-auto">
                      <TrendingDown className="w-3.5 h-3.5 text-blue-600" />
                      {estabList.length} mercados comparados
                    </span>
                  )}
                </div>

                {/* Destaques comparativos entre mercados */}
                {temComparacao && (
                  <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
                      <p className="font-semibold text-emerald-800 flex items-center gap-1.5 mb-1">
                        <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                        Melhor Escolha: {menor.estab}
                      </p>
                      <p className="text-emerald-700">
                        Preço médio mais em conta: <strong>{formatCurrency(menor.avg)}</strong>. Se tivesse comprado tudo aqui, sua economia estimada seria de <strong>{formatCurrency(economiaEstimada)}</strong>.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                      <p className="font-semibold text-amber-800 flex items-center gap-1.5 mb-1">
                        <ArrowUpRight className="w-4 h-4 text-amber-600" />
                        Diferença entre o Mais Barato e Mais Caro
                      </p>
                      <p className="text-amber-700">
                        O <strong>{maior.estab}</strong> foi <strong>{diffPct.toFixed(1)}% mais caro</strong> (+{formatCurrency(diffValor)} por unidade) em comparação ao {menor.estab}.
                      </p>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-medium text-gray-600 rounded-tl-lg">
                          Estabelecimento
                        </th>
                        <th className="text-right p-3 font-medium text-gray-600">
                          Preço Médio
                        </th>
                        <th className="text-center p-3 font-medium text-gray-600">
                          Comparação vs Menor
                        </th>
                        <th className="text-right p-3 font-medium text-gray-600">
                          Último Preço
                        </th>
                        <th className="text-right p-3 font-medium text-gray-600">
                          Compras
                        </th>
                        <th className="text-right p-3 font-medium text-gray-600 rounded-tr-lg">
                          Total Gasto
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {estabList.map((item, idx) => {
                        const isCheapest = idx === 0 && temComparacao;
                        const isMostExpensive = idx === estabList.length - 1 && temComparacao;
                        const diffVsMenor = item.avg - menor.avg;
                        const pctVsMenor = menor.avg > 0 ? (diffVsMenor / menor.avg) * 100 : 0;

                        return (
                          <tr
                            key={item.estab}
                            className={`border-t border-gray-100 ${
                              isCheapest
                                ? "bg-emerald-50/40"
                                : isMostExpensive
                                ? "bg-rose-50/30"
                                : ""
                            }`}
                          >
                            <td className="p-3 text-gray-800 font-medium">
                              <div className="flex items-center gap-2">
                                <span>{item.estab}</span>
                                {isCheapest && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-300">
                                    Mais barato
                                  </span>
                                )}
                                {isMostExpensive && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-semibold border border-rose-300">
                                    Mais caro
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-right font-bold text-gray-800">
                              {formatCurrency(item.avg)}
                            </td>
                            <td className="p-3 text-center">
                              {isCheapest ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800">
                                  Menor preço (Base)
                                </span>
                              ) : temComparacao ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800">
                                  +{pctVsMenor.toFixed(1)}% (+{formatCurrency(diffVsMenor)})
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-3 text-right text-gray-600">
                              {formatCurrency(item.data.ultimoPreco)}
                            </td>
                            <td className="p-3 text-right text-gray-600">
                              {item.data.count}x
                            </td>
                            <td className="p-3 text-right font-semibold text-gray-800">
                              {formatCurrency(item.data.total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Ranking */}
      {!produtoSelecionado && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Ranking header */}
          <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-600" />
              Ranking de Produtos
              <span className="text-sm font-normal text-gray-500">
                ({produtosFiltrados.length} produtos)
              </span>
            </h2>
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs">
              {(
                [
                  { key: "gasto" as const, label: "Maior Gasto" },
                  { key: "frequencia" as const, label: "Mais Frequente" },
                  { key: "quantidade" as const, label: "Maior Qtd" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setRankingOrder(opt.key)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    rankingOrder === opt.key
                      ? "bg-green-600 text-white shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product list */}
          <div className="divide-y divide-gray-100">
            {ranking.length === 0 && (
              <div className="py-12 text-center text-gray-500">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="font-medium">Nenhum produto encontrado</p>
                <p className="text-sm mt-1">
                  Tente ajustar os filtros ou o período
                </p>
              </div>
            )}

            {ranking.map((p, idx) => {
              const maxValue =
                rankingOrder === "gasto"
                  ? ranking[0]?.totalGasto || 1
                  : rankingOrder === "frequencia"
                  ? ranking[0]?.vezesComprado || 1
                  : ranking[0]?.totalQuantidade || 1;

              const currentValue =
                rankingOrder === "gasto"
                  ? p.totalGasto
                  : rankingOrder === "frequencia"
                  ? p.vezesComprado
                  : p.totalQuantidade;

              const percentage = (currentValue / maxValue) * 100;

              return (
                <button
                  key={`${p.nome}-${idx}`}
                  onClick={() => {
                    setProdutoSelecionado(p);
                    setBusca(p.nome);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full text-left p-4 hover:bg-green-50/50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    {/* Rank number */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        idx < 3
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {idx + 1}
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-gray-800 truncate group-hover:text-green-700 transition-colors">
                          {p.nome}
                        </p>
                        <VariacaoBadge variacao={p.variacao} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{p.vezesComprado}x comprado</span>
                        <span>•</span>
                        <span>
                          Última: {formatDate(p.ultimaData)}
                        </span>
                        {p.categoria && (
                          <>
                            <span>•</span>
                            <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {p.categoria.nome}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-green-500 transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Values */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-800">
                        {formatCurrency(p.totalGasto)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatCurrency(p.mediaPrecoUnitario)}/un
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Show more hint */}
          {produtosFiltrados.length > 20 && (
            <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
              Mostrando os 20 primeiros de {produtosFiltrados.length} produtos.
              Use a busca para encontrar um produto específico.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
