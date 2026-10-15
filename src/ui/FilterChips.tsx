import type { Category } from '../types.ts';
import { Icon } from './Icon.tsx';

interface Props {
  categories: Category[];
  categoryId: string;
  onCategory: (id: string) => void;
  favOnly: boolean;
  onFavOnly: (v: boolean) => void;
}

export function FilterChips({ categories, categoryId, onCategory, favOnly, onFavOnly }: Props) {
  return (
    <div className="chips" role="group" aria-label="تصفية حسب التصنيف">
      <button
        type="button"
        className={`chip ${favOnly ? 'chip-on' : ''}`}
        aria-pressed={favOnly}
        onClick={() => onFavOnly(!favOnly)}
      >
        <Icon name="heart" size={16} filled={favOnly} /> المفضلة
      </button>
      <button
        type="button"
        className={`chip ${categoryId === 'all' ? 'chip-on' : ''}`}
        aria-pressed={categoryId === 'all'}
        onClick={() => onCategory('all')}
      >
        الكل
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`chip ${categoryId === c.id ? 'chip-on' : ''}`}
          aria-pressed={categoryId === c.id}
          onClick={() => onCategory(c.id)}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
