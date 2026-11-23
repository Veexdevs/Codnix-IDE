export interface TemplateDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  files: Record<string, string>;
}

const readme = (name: string, desc: string, run: string) =>
  `# ${name}\n\n${desc}\n\n## Como executar\n\n\`\`\`bash\n${run}\n\`\`\`\n\nProjeto criado com CODNIX IDE.\n`;

const gitignore = `node_modules/\ndist/\nbuild/\nbin/\nout/\n__pycache__/\n*.pyc\n.DS_Store\n.env\n`;

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'cpp',
    name: 'Projeto C++',
    description: 'Projeto C++ com CMake, src/, include/ e assets — ideal para aprender e compilar com g++.',
    icon: 'cpp',
    files: {
      'src/main.cpp': `#include <iostream>\n#include "utils.hpp"\n\nint main() {\n    std::cout << "Bem-vindo ao Codnix IDE!" << std::endl;\n\n    auto result = getMessage();\n    std::cout << result << std::endl;\n\n    return 0;\n}\n`,
      'src/utils.cpp': `#include "utils.hpp"\n\nstd::string getMessage() {\n    return "Mensagem: Programando com IA e incrivel!";\n}\n`,
      'include/utils.hpp': `#ifndef UTILS_HPP\n#define UTILS_HPP\n\n#include <string>\n\nstd::string getMessage();\n\n#endif\n`,
      'CMakeLists.txt': `cmake_minimum_required(VERSION 3.10)\nproject(MeuProjeto)\n\nset(CMAKE_CXX_STANDARD 17)\n\ninclude_directories(include)\n\nadd_executable(app src/main.cpp src/utils.cpp)\n`,
      '.gitignore': gitignore + 'bin/\n',
      'README.md': readme('MeuProjeto', 'Projeto C++ de exemplo do CODNIX IDE.', 'g++ -Iinclude src/*.cpp -o bin/app && ./bin/app'),
    },
  },
  {
    id: 'web-app',
    name: 'Aplicação Web',
    description: 'Site em HTML + CSS + JavaScript moderno, com preview integrado no CODNIX.',
    icon: 'globe',
    files: {
      'index.html': `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Minha Aplicação</title>\n  <link rel="stylesheet" href="css/styles.css" />\n</head>\n<body>\n  <main class="hero">\n    <h1>Olá, mundo!</h1>\n    <p>Aplicação criada com CODNIX IDE.</p>\n    <button id="btn">Contador: 0</button>\n  </main>\n  <script src="js/app.js"></script>\n</body>\n</html>\n`,
      'css/styles.css': `:root {\n  --bg: #0a0a0b;\n  --accent: #2f7bff;\n  --ink: #e8e8ec;\n}\n* { margin: 0; padding: 0; box-sizing: border-box; }\nbody {\n  background: var(--bg);\n  color: var(--ink);\n  font-family: system-ui, sans-serif;\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n}\n.hero { text-align: center; }\nh1 { font-size: 2.5rem; margin-bottom: .5rem; }\np { color: #a0a0a8; margin-bottom: 1.5rem; }\nbutton {\n  background: var(--accent);\n  border: none;\n  color: #fff;\n  padding: .75rem 1.5rem;\n  border-radius: 8px;\n  font-size: 1rem;\n  cursor: pointer;\n}\n`,
      'js/app.js': `const btn = document.getElementById('btn');\nlet count = 0;\nbtn.addEventListener('click', () => {\n  count++;\n  btn.textContent = \`Contador: \${count}\`;\n});\n`,
      'README.md': readme('Minha Aplicação', 'Aplicação web estática (HTML/CSS/JS).', 'Use o botão Preview do CODNIX para visualizar index.html'),
    },
  },
  {
    id: 'html-site',
    name: 'Site HTML',
    description: 'Site simples de várias páginas, pronto para publicar.',
    icon: 'code',
    files: {
      'index.html': `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>Meu Site</title>\n  <link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n  <header><nav><a href="index.html">Início</a> <a href="sobre.html">Sobre</a></nav></header>\n  <main>\n    <h1>Meu Site</h1>\n    <p>Página inicial do meu site.</p>\n  </main>\n</body>\n</html>\n`,
      'sobre.html': `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8" />\n  <title>Sobre</title>\n  <link rel="stylesheet" href="styles.css" />\n</head>\n<body>\n  <header><nav><a href="index.html">Início</a> <a href="sobre.html">Sobre</a></nav></header>\n  <main><h1>Sobre</h1><p>Sobre este site.</p></main>\n</body>\n</html>\n`,
      'styles.css': `body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 720px; padding: 0 1rem; color: #222; }\nheader nav a { margin-right: 1rem; color: #2f7bff; text-decoration: none; }\nh1 { margin: 1rem 0; }\n`,
    },
  },
  {
    id: 'react-app',
    name: 'Aplicação React',
    description: 'Projeto React com Vite — instale as dependências e rode no terminal do CODNIX.',
    icon: 'atom',
    files: {
      'package.json': `{\n  "name": "meu-react-app",\n  "private": true,\n  "version": "0.1.0",\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "preview": "vite preview"\n  },\n  "dependencies": {\n    "react": "^18.3.1",\n    "react-dom": "^18.3.1"\n  },\n  "devDependencies": {\n    "@vitejs/plugin-react": "^4.3.3",\n    "vite": "^5.4.10"\n  }\n}\n`,
      'vite.config.js': `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({\n  plugins: [react()],\n  server: { host: true, port: 5173 },\n});\n`,
      'index.html': `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>App React</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.jsx"></script>\n</body>\n</html>\n`,
      'src/main.jsx': `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
      'src/App.jsx': `import { useState } from 'react';\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <main style={{ fontFamily: 'system-ui', textAlign: 'center', paddingTop: '4rem' }}>\n      <h1>App React + CODNIX</h1>\n      <button onClick={() => setCount((c) => c + 1)}>Cliques: {count}</button>\n    </main>\n  );\n}\n`,
      '.gitignore': gitignore,
    },
  },
  {
    id: 'python-app',
    name: 'Aplicação Python',
    description: 'Projeto Python com módulos, testes e requirements.txt.',
    icon: 'terminal',
    files: {
      'main.py': `"""Aplicação Python do CODNIX IDE."""\n\n\ndef saudacao(nome: str = "Codnix") -> str:\n    return f"Olá, {nome}! Bem-vindo ao CODNIX IDE."\n\n\ndef main() -> None:\n    print(saudacao())\n    print("Soma 2 + 3 =", somar(2, 3))\n\n\ndef somar(a: float, b: float) -> float:\n    return a + b\n\n\nif __name__ == "__main__":\n    main()\n`,
      'requirements.txt': `# Dependências do projeto\n`,
      'tests/test_main.py': `from main import saudacao, somar\n\n\ndef test_somar():\n    assert somar(2, 3) == 5\n\n\ndef test_saudacao():\n    assert "Codnix" in saudacao()\n`,
      'README.md': readme('App Python', 'Aplicação Python de exemplo.', 'python3 main.py'),
    },
  },
  {
    id: 'rest-api',
    name: 'API REST',
    description: 'API REST em Node.js sem dependências externas — pronta para rodar.',
    icon: 'server',
    files: {
      'package.json': `{\n  "name": "minha-api",\n  "private": true,\n  "version": "0.1.0",\n  "scripts": { "start": "node server.js" }\n}\n`,
      'server.js': `const http = require('node:http');\n\nconst routes = {\n  '/api/hello': () => ({ message: 'Olá do CODNIX IDE!' }),\n  '/api/time': () => ({ now: new Date().toISOString() }),\n};\n\nconst server = http.createServer((req, res) => {\n  res.setHeader('Content-Type', 'application/json');\n  const handler = routes[req.url];\n  if (handler) {\n    res.end(JSON.stringify(handler()));\n  } else {\n    res.statusCode = 404;\n    res.end(JSON.stringify({ error: 'Rota não encontrada' }));\n  }\n});\n\nconst PORT = process.env.PORT || 3000;\nserver.listen(PORT, () => console.log(\`API rodando na porta \${PORT}\`));\n`,
      'README.md': readme('Minha API', 'API REST Node.js.', 'npm start'),
    },
  },
  {
    id: 'node-app',
    name: 'Aplicação Node.js',
    description: 'Aplicação Node.js moderna com ES Modules.',
    icon: 'hexagon',
    files: {
      'package.json': `{\n  "name": "meu-node-app",\n  "private": true,\n  "version": "0.1.0",\n  "type": "module",\n  "scripts": { "start": "node index.js" }\n}\n`,
      'index.js': `console.log('Bem-vindo ao CODNIX IDE!');\n\nconst tarefas = ['explorar o editor', 'conversar com a IA', 'criar algo incrível'];\ntarefas.forEach((t, i) => console.log(\`\${i + 1}. \${t}\`));\n`,
      'README.md': readme('App Node.js', 'Aplicação Node.js de exemplo.', 'npm start'),
    },
  },
];

export function templateById(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
