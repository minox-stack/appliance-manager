import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon.tsx';

export type ToastKind = 'success' | 'error' | 'info';
type Push = (message: string, kind?: ToastKind) => void;

interface Item {
  id: number;
  message: string;
  kind: ToastKind;
}

const Ctx = createContext<Push>(() => undefined);

export function useToast(): Push {
  return useContext(Ctx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);

  const push = useCallback<Push>((message, kind = 'success') => {
    const id = ++seq.current;
    setItems((s) => [...s.slice(-2), { id, message, kind }]);
    window.setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), kind === 'error' ? 4800 : 2600);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast glass toast-${t.kind}`}>
            <Icon name={t.kind === 'error' ? 'alert' : t.kind === 'info' ? 'info' : 'check'} size={20} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
