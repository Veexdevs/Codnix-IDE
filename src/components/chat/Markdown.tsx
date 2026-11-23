'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js/lib/common';
import { Check, Copy, FileUp } from 'lucide-react';
import { useState } from 'react';

function CodeBlock({ code, lang, onSendToProject }: { code: string; lang: string; onSendToProject?: (code: string, lang: string) => void }) {
  const [copied, setCopied] = useState(false);
  let highlighted = '';
  try {
    if (lang && hljs.getLanguage(lang)) {
      highlighted = hljs.highlight(code, { language: lang }).value;
    } else {
      highlighted = hljs.highlightAuto(code).value;
    }
  } catch {
    highlighted = code.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] || c));
  }

  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-edge bg-panel">
      <div className="flex items-center justify-between border-b border-edge bg-panel-2 px-3 py-1.5">
        <span className="text-2xs font-medium uppercase tracking-wider text-ink-3">{lang || 'código'}</span>
        <div className="flex items-center gap-1">
          {onSendToProject && (
            <button
              onClick={() => onSendToProject(code, lang)}
              className="flex items-center gap-1 rounded px-1.5 py-1 text-2xs text-ink-3 hover:bg-panel-3 hover:text-accent"
              title="Enviar este código para um arquivo do projeto"
            >
              <FileUp size={12} /> Projeto
            </button>
          )}
          <button
            onClick={copy}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-2xs text-ink-3 hover:bg-panel-3 hover:text-ink"
            title="Copiar código"
          >
            {copied ? <Check size={12} className="text-ok" /> : <Copy size={12} />} {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
        <code className="font-mono" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  );
}

export default function Markdown({
  content,
  streaming,
  onSendToProject,
}: {
  content: string;
  streaming?: boolean;
  onSendToProject?: (code: string, lang: string) => void;
}) {
  return (
    <div className={`codnix-md ${streaming ? 'stream-cursor' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const raw = String(children).replace(/\n$/, '');
            if (match || raw.includes('\n')) {
              return <CodeBlock code={raw} lang={match?.[1] || ''} onSendToProject={onSendToProject} />;
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          a({ children, href, ...props }) {
            return (
              <a href={href} target="_blank" rel="noreferrer" {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
