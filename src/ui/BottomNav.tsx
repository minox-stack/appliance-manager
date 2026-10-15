import { Icon } from './Icon.tsx';
import type { IconName } from './Icon.tsx';
import type { Tab } from '../app/context.ts';

const ITEMS: { tab: Tab; label: string; icon: IconName }[] = [
  { tab: 'home', label: 'الرئيسية', icon: 'home' },
  { tab: 'products', label: 'المنتجات', icon: 'box' },
  { tab: 'categories', label: 'التصنيفات', icon: 'grid' },
  { tab: 'settings', label: 'الإعدادات', icon: 'settings' },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="nav glass" aria-label="التنقل الرئيسي">
      {ITEMS.map((i) => (
        <button
          key={i.tab}
          type="button"
          className="nav-item"
          aria-current={tab === i.tab ? 'page' : undefined}
          onClick={() => onChange(i.tab)}
        >
          <Icon name={i.icon} size={24} />
          <span>{i.label}</span>
        </button>
      ))}
    </nav>
  );
}
