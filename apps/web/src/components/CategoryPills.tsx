'use client';

import React from 'react';
import { MARKETPLACE_CATEGORIES, ServiceCategory } from '@mercadopleis/types';
import { Code, Palette, Megaphone, Briefcase, LayoutGrid } from 'lucide-react';

const ICON_MAP = {
  Code,
  Palette,
  Megaphone,
  Briefcase,
};

interface CategoryPillsProps {
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
}

export function CategoryPills({ selectedCategory, onSelectCategory }: CategoryPillsProps) {
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
        <span>Todos</span>
      </button>

      {MARKETPLACE_CATEGORIES.map((cat) => {
        const IconComponent = ICON_MAP[cat.icon as keyof typeof ICON_MAP] || Code;
        const isSelected = selectedCategory === cat.id;

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
            <span>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
}
