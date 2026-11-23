'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Code2, MessageSquare, Package, Settings2, Layers } from 'lucide-react';

const ITEMS = [
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/ide', label: 'Editor', icon: Code2 },
  { href: '/', label: 'Projetos', icon: Package },
  { href: '/models', label: 'Modelos', icon: Layers },
  { href: '/settings', label: 'Config', icon: Settings2 },
];

export default function MobileNav() {
  const pathname = usePathname();
  return (
    <nav className="flex h-14 shrink-0 items-stretch border-t border-edge bg-panel md:hidden">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-2xs ${
              active ? 'accent-text' : 'text-ink-3'
            }`}
          >
            <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
            {label}
            {active && <span className="absolute" />}
          </Link>
        );
      })}
    </nav>
  );
}
