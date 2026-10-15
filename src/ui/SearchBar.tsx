import { Icon } from './Icon.tsx';

interface Props {
  value: string;
  onChange: (v: string) => void;
  large?: boolean;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  large = false,
  placeholder = 'ابحث بالاسم أو الماركة أو الموديل…',
}: Props) {
  return (
    <div className={`search glass ${large ? 'search-lg' : ''}`} role="search">
      <Icon name="search" size={large ? 24 : 21} />
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="بحث عن جهاز"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      {value ? (
        <button type="button" className="icon-btn search-clear" aria-label="مسح البحث" onClick={() => onChange('')}>
          <Icon name="x" size={18} />
        </button>
      ) : null}
    </div>
  );
}
