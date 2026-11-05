import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, Lock, Database, UserCheck, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de Privacidade - De Olho na Nota",
  description: "Política de Privacidade e Proteção de Dados do aplicativo De Olho na Nota.",
};

export default function PoliticaPrivacidadePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 text-slate-800 antialiased py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o Login
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-10">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-6 mb-8">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Política de Privacidade</h1>
              <p className="text-sm text-slate-500 mt-1">Última atualização: Março de 2026</p>
            </div>
          </div>

          <div className="space-y-8 text-sm sm:text-base leading-relaxed text-slate-700">
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                1. Visão Geral
              </h2>
              <p>
                O aplicativo <strong>De Olho na Nota</strong> foi desenvolvido para ajudar você a organizar e acompanhar
                seus gastos a partir da leitura e conferência de cupons e notas fiscais. Levamos a sua privacidade e a
                segurança dos seus dados a sério, atuando em total conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)
                e com as políticas de serviços de dados do Google.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Database className="h-5 w-5 text-emerald-600" />
                2. Informações que Coletamos
              </h2>
              <p className="mb-2">Coletamos apenas as informações estritamente necessárias para o funcionamento do serviço:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                <li>
                  <strong>Dados de Conta e Autenticação (Google OAuth):</strong> Quando você opta por entrar utilizando o Google,
                  coletamos seu nome completo, endereço de e-mail e URL da foto de perfil. Não temos acesso à sua senha do Google.
                </li>
                <li>
                  <strong>Dados de Notas e Compras:</strong> Itens, valores, datas e estabelecimentos contidos nos cupons fiscais
                  que você escaneia ou cadastra manualmente na plataforma.
                </li>
                <li>
                  <strong>Dados Técnicos:</strong> Informações básicas de conexão e dispositivo para fins de estabilidade, segurança e prevenção a abusos.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-emerald-600" />
                3. Finalidade do Uso dos Dados
              </h2>
              <p className="mb-2">Seus dados são utilizados exclusivamente para:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                <li>Criar, autenticar e gerenciar sua conta de usuário.</li>
                <li>Processar as informações das notas fiscais e exibir seus relatórios e gráficos de gastos pessoais.</li>
                <li>Sincronizar suas listas de compras e controle financeiro entre seus dispositivos.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Lock className="h-5 w-5 text-emerald-600" />
                4. Compartilhamento e Proteção de Dados
              </h2>
              <p className="mb-2">
                <strong>Nós não vendemos, não alugamos e não compartilhamos seus dados pessoais com terceiros</strong> para finalidades publicitárias ou comerciais.
              </p>
              <p>
                O uso e a transferência para qualquer outro aplicativo de informações recebidas das APIs do Google seguirão a{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 underline font-medium hover:text-emerald-800"
                >
                  Política de Dados do Usuário dos Serviços de API do Google
                </a>
                , incluindo os requisitos de Uso Limitado (Limited Use Requirements).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Seus Direitos e Exclusão de Conta</h2>
              <p>
                Você tem o direito de acessar, corrigir ou solicitar a exclusão definitiva dos seus dados e da sua conta a qualquer momento.
                Ao solicitar a exclusão da conta, todos os registros de notas fiscais, listas e dados de perfil associados serão permanentemente removidos de nossos servidores.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Mail className="h-5 w-5 text-emerald-600" />
                6. Contato
              </h2>
              <p>
                Em caso de dúvidas, solicitações ou esclarecimentos sobre esta Política de Privacidade ou sobre o tratamento dos seus dados,
                entre em contato pelo e-mail:{" "}
                <a
                  href="mailto:nicolasjap@hotmail.com"
                  className="text-emerald-700 underline font-medium hover:text-emerald-800"
                >
                  nicolasjap@hotmail.com
                </a>
                .
              </p>
            </section>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          © {new Date().getFullYear()} De Olho na Nota. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
