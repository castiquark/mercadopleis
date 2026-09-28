import React from 'react';
import { MARKETPLACE_CATEGORIES } from '@mercadopleis/types';
import { useLanguage } from '@/lib/languageContext';
import {
  Code,
  Palette,
  Megaphone,
  FileText,
  Bot,
  ShieldCheck,
  Briefcase,
  Film,
  Scale,
  MoreHorizontal,
  LayoutGrid,
} from 'lucide-react';

const ICON_MAP = {
  Code,
  Palette,
  Megaphone,
  FileText,
  Bot,
  ShieldCheck,
  Briefcase,
  Film,
  Scale,
  MoreHorizontal,
};

interface CategoryPillsProps {
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export function CategoryPills({ selectedCategory, onSelectCategory }: CategoryPillsProps) {
  const { language, t } = useLanguage();

  return (
    <div className="flex flex-wrap items-center gap-2 py-4">
      <button
        onClick={() => onSelectCategory(null)}
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
          selectedCategory === null
            ? 'bg-primary text-white shadow-md shadow-primary/25'
            : 'border border-border bg-surface text-slate-300 hover:border-slate-600 hover:text-white'
        }`}
      >
        <LayoutGrid className="h-4 w-4" />
        <span>{t('allCategories')}</span>
      </button>

      {MARKETPLACE_CATEGORIES.map((cat) => {
        const IconComponent = ICON_MAP[cat.icon as keyof typeof ICON_MAP] || MoreHorizontal;
        const isSelected = selectedCategory === cat.id;
        const displayName = language === 'en' ? (cat.nameEn || cat.name) : cat.name;

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(isSelected ? null : cat.id)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              isSelected
                ? 'bg-primary text-white shadow-md shadow-primary/25'
                : 'border border-border bg-surface text-slate-300 hover:border-slate-600 hover:text-white'
            }`}
          >
            <IconComponent className="h-4 w-4" />
            <span>{displayName}</span>
          </button>
        );
      })}
    </div>
  );
}

