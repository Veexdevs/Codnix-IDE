<div align="center">

# ⚡ CODNIX IDE

**Multiple Models. One Development Environment.**

Ambiente de desenvolvimento profissional com múltiplas inteligências artificiais trabalhando em conjunto — inspirado em Cursor, Claude Code, Windsurf e VS Code, com identidade visual própria.

Web (Vercel) · Android (APK) · Windows (EXE) · iOS (IPA)

</div>

---

## 🚀 Funcionalidades

### Sistema Multi-IA (OpenRouter)
- **Todos os modelos gratuitos do OpenRouter carregados dinamicamente** (nada de lista fixa), com pesquisa, favoritos, atualização manual e paginação de detalhes (nome, fornecedor, id, contexto).
- **Modo Individual** — converse com um modelo escolhido.
- **Modo Equipe** — pipeline de IAs: Analista → Planejador → Revisor → Depurador → Consolidador (configurável na aba Agentes).
- **Modo Comparação** — a mesma pergunta para 2–4 modelos, respostas lado a lado.
- **Modo Desenvolvedor** — a IA analisa o projeto, propõe criação/edição/exclusão de arquivos com **diff antes de aplicar** e aceitar/rejeitar por alteração.
- **Modo Revisão** — um modelo escreve o código e os outros revisam em paralelo.
- Streaming de respostas em tempo real, exibição do modelo que respondeu, tratamento de erros (chave inválida, rate limit, créditos, modelo indisponível, conexão).

### Editor de código real (Monaco)
- Syntax highlighting para **HTML, CSS, JavaScript, TypeScript, Python, C, C++, C#, Java, Kotlin, Swift, PHP, Rust, Go, Lua, JSON, XML, YAML, Markdown** e mais.
- Numeração de linhas, abas múltiplas, autocomplete, busca/substituição, formatação, detecção de erros (painel Problemas), salvamento automático configurável, histórico de versões e restauração.

### Explorer e contexto
- Árvore completa de arquivos com criar/renomear/excluir arquivos e pastas.
- Indexação do projeto (outline) enviada às IAs como contexto — **sem enviar todos os arquivos indiscriminadamente**.
- Seleção manual de arquivos de contexto, exclusão de pastas, orçamento de contexto e busca textual em todo o projeto.

### Terminal real
- Shell bash no servidor do projeto, com histórico, múltiplas sessões, limpeza, timeout e **bloqueio automático de comandos destrutivos** (rm -rf /, sudo, scripts remotos, etc.).
- Compila e executa projetos (ex.: `g++ -Iinclude src/*.cpp -o bin/app && ./bin/app`) e **sincroniza automaticamente** arquivos criados/modificados de volta ao projeto.

### Multiplataforma
| Plataforma | Como gerar | Artefato |
|---|---|---|
| **Web** | Deploy automático (GitHub + Vercel) | site responsivo (desktop + mobile retrato/paisagem) |
| **Android** | Actions → `android.yml` | APK debug + release |
| **Windows** | Actions → `windows.yml` | Instalador NSIS + portable EXE |
| **iOS** | Actions → `ios.yml` | IPA (não assinado sem certificados) |

---

## 🔑 Configuração da API Key (OpenRouter)

O CODNIX **não vem com chave embutida**. Você tem duas opções (a segunda tem prioridade):

1. **Variável de ambiente** — `OPENROUTER_API_KEY` (ex.: `.env.local` em desenvolvimento, Environment Variables na Vercel).
2. **Tela Configurações → OpenRouter** — cole a chave; ela é armazenada **apenas no servidor** (nunca no navegador) e pode ser alterada/removida a qualquer momento. Há botão de **Testar conexão** que mostra uso e limite da conta.

Crie sua chave em [openrouter.ai/keys](https://openrouter.ai/keys). Todas as chamadas passam pelo backend (`/api/chat`) — a chave nunca chega ao frontend.

### Variáveis de ambiente

```bash
# obrigatória para IA (ou configure pela tela de Configurações)
OPENROUTER_API_KEY=

# persistência em nuvem (opcional; sem elas usa data/ local)
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_API_KEY=sb_publishable_...

# apps nativos apontando para o backend publicado
NEXT_PUBLIC_API_BASE_URL=
```

---

## 💻 Desenvolvimento local

```bash
npm install
cp .env.example .env.local   # edite com sua chave
npm run dev                  # http://localhost:3000
```

Testes: `npm test` · Tipos: `npm run typecheck` · Build: `npm run build`

## 🌐 Deploy na Vercel

1. Conecte o repositório `Veexdevs/Codnix-IDE` na Vercel (import GitHub).
2. Configure as variáveis de ambiente acima (Production + Preview).
3. Deploy. O `vercel.json` já define o framework e limites das functions.

## 📱 Android / 🖥 Windows / 🍎 iOS

Abra a aba **Actions** no GitHub e execute manualmente (`workflow_dispatch`) os workflows:

- `android.yml` → artefato `codnix-android-apk` (debug + release-unsigned)
- `windows.yml` → artefato `codnix-windows-exe` (Setup + Portable)
- `ios.yml` → artefato `codnix-ios-ipa` (não assinado — veja limitações no cabeçalho do workflow)

Os apps nativos carregam o CODNIX publicado (Vercel) — defina `server.url` em `capacitor.config.json` e `CODNIX_APP_URL` no desktop para a sua URL.

## 🧱 Arquitetura

```
src/
├── app/                 # Páginas e rotas de API (Next.js App Router)
│   ├── page.tsx         # Home: projetos, templates, favoritos, histórico
│   ├── ide/             # IDE desktop + mobile (retrato e paisagem)
│   ├── chat/            # Chat mobile minimalista (histórico, streaming, anexos)
│   ├── models/          # Catálogo de modelos gratuitos do OpenRouter
│   ├── settings/        # Configurações (API key, editor, terminal, agentes, privacidade)
│   └── api/             # Backend seguro: chat (stream), models, projects, files,
│                        #   search, index, export, terminal, preview, settings, chats
├── components/          # UI: Editor Monaco, Explorer, Terminal, Assistant, Diff...
├── lib/                 # openrouter.ts, storage.ts (Supabase + fallback FS),
│                        #   workspace.ts (terminal/preview), templates, diff, dev-tools
├── store/               # Zustand: app (IDE), chat (conversas), settings (preferências)
└── types/               # Tipos compartilhados
desktop/                 # Electron (Windows EXE)
.github/workflows/       # ci.yml, android.yml, windows.yml, ios.yml
```

**Persistência**: Supabase Postgres (quando `SUPABASE_URL`/`SUPABASE_API_KEY` definidos) com *fallback* automático para arquivos locais (`data/`). Projetos, conversas e configurações seguras ficam no servidor; preferências de UI ficam no navegador.

---

<div align="center">
CODNIX IDE — construído com Next.js, Monaco, OpenRouter, Supabase e Capacitor/Electron.
</div>
