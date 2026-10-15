import type { ReactNode } from 'react';
import { Icon } from './Icon.tsx';

interface OverlayProps {
  title: string;
  onBack: () => void;
  extra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** صفحة كاملة فوق التبويبات (التفاصيل / نموذج الإضافة والتعديل). */
export function Overlay({ title, onBack, extra, footer, children }: OverlayProps) {
  return (
    <div className="overlay">
      <header className="overlay-head">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="رجوع">
          <Icon name="chevron" />
        </button>
        <h1 className="overlay-title">{title}</h1>
        <div className="overlay-extra">{extra}</div>
      </header>
      <div className="overlay-body">{children}</div>
      {footer ? <div className="overlay-foot">{footer}</div> : null}
    </div>
  );
}
