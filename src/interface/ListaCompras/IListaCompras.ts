export interface MercadoHistorico {
  cnpj: string
  nomeOriginal: string
  nomeDepara: string | null
  totalNotas: number
  mesesDisponiveis: number
}

export interface ItemRascunho {
  termoFalado: string
  quantidade: number
  unidade: string
  adicionadoEm?: string
}

export interface RascunhoListaComprasData {
  _id?: string
  itens: ItemRascunho[]
  updatedAt?: string
}

export type OrigemMatchRag =
  | 'MERCADO_SELECIONADO'
  | 'OUTRO_MERCADO'
  | 'SEM_HISTORICO'
  | 'RECORRENCIA'
  | 'MANUAL'

export interface ItemLista {
  nome: string
  nomeOriginal: string
  termoFalado?: string | null
  nomeMercado?: string | null
  origemMatch?: OrigemMatchRag
  estabelecimentoOrigem?: string | null
  quantidade: number
  unidade: string
  pesoEstimadoKg?: number
  valorEstimado: number
  valorUnitarioRecente: number
  frequencia: number
  comprado: boolean
}

export interface ListaComprasData {
  _id: string
  cnpj: string
  nomeEstabelecimento: string
  periodoAnaliseMeses: number
  estimativaTotal: number
  itens: ItemLista[]
  createdAt: string
  updatedAt: string
}

export interface ProdutoApelido {
  _id: string
  nomeOriginal: string
  apelido: string
}
