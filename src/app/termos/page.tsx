import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowLeft, CheckCircle2, AlertCircle, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Termos de Serviço - CupomHub",
  description: "Termos e Condições de Uso do aplicativo CupomHub.",
};

export default function TermosServicoPage() {
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
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Termos de Serviço</h1>
              <p className="text-sm text-slate-500 mt-1">Última atualização: Março de 2026</p>
            </div>
          </div>

          <div className="space-y-8 text-sm sm:text-base leading-relaxed text-slate-700">
            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">1. Aceitação dos Termos</h2>
              <p>
                Ao criar uma conta ou utilizar o aplicativo <strong>CupomHub</strong>, você concorda com estes
                Termos de Serviço e com nossa Política de Privacidade. Caso não concorde com qualquer disposição,
                solicitamos que não utilize a plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                2. Descrição do Serviço
              </h2>
              <p>
                O <strong>CupomHub</strong> é uma ferramenta de gestão financeira e controle pessoal de compras,
                permitindo a leitura de QR codes de notas fiscais de consumidor (NFC-e), conferência de itens, organização
                por categorias e acompanhamento de preços e gastos.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">3. Cadastro e Segurança da Conta</h2>
              <p>
                O acesso pode ser realizado através de login tradicional ou autenticação integrada com a conta Google (Google OAuth).
                Você é responsável por manter a confidencialidade do seu acesso e por todas as atividades que ocorrem sob sua conta.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-emerald-600" />
                4. Uso Aceitável
              </h2>
              <p className="mb-2">Você concorda em utilizar o serviço de forma lícita, sendo expressamente proibido:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                <li>Tentar acessar indevidamente dados de outros usuários ou servidores da aplicação.</li>
                <li>Utilizar ferramentas automatizadas (bots ou scrapers) para sobrecarregar a infraestrutura.</li>
                <li>Inserir dados fraudulentos ou enganosos na plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">5. Modificações e Encerramento</h2>
              <p>
                Podemos atualizar estes termos periodicamente para refletir melhorias no sistema ou mudanças regulatórias.
                O uso continuado da aplicação após alterações implica na aceitação dos novos termos.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-slate-900 mb-2 flex items-center gap-2">
                <Mail className="h-5 w-5 text-emerald-600" />
                6. Contato e Suporte
              </h2>
              <p>
                Para dúvidas referentes aos Termos de Serviço, envie uma mensagem para:{" "}
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
          © {new Date().getFullYear()} CupomHub. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
