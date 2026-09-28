'use client';

import React from 'react';
import Link from 'next/link';
import { Service, MARKETPLACE_CATEGORIES } from '@mercadopleis/types';
import { useLanguage } from '@/lib/languageContext';
import { Clock, Shield, Star } from 'lucide-react';

interface ServiceCardProps {
  service: Service;
  onBook: (service: Service) => void;
}

export function ServiceCard({ service, onBook }: ServiceCardProps) {
  const { language } = useLanguage();

  const categoryObj = MARKETPLACE_CATEGORIES.find((c) => c.id === service.category);
  const categoryLabel = categoryObj
    ? language === 'en'
      ? categoryObj.nameEn || categoryObj.name
      : categoryObj.name
    : service.category;

  return (
    <div className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:border-slate-600 hover:shadow-xl hover:shadow-primary/5">
      <div>
        {/* Category & Badge */}
        <div className="flex items-center justify-between">
          <span className="rounded-md bg-surface-elevated px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {categoryLabel}
          </span>
          <div className="flex items-center gap-1 text-xs font-medium text-amber-400">
            <Star className="h-3.5 w-3.5 fill-current" />
            <span>5.0</span>
          </div>
        </div>

        {/* Title */}
        <Link href={`/services/${service.slug}`}>
          <h3 className="mt-3 text-lg font-semibold text-white transition group-hover:text-primary-light cursor-pointer">
            {service.title}
          </h3>
        </Link>

        {/* Description snippet */}
        <p className="mt-2 line-clamp-2 text-sm text-slate-400">
          {service.description}
        </p>
      </div>

      <div className="mt-6 border-t border-border/80 pt-4">
        {/* Delivery timeframe & Escrow guarantee */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
            {language === 'en'
              ? `Delivery: ${service.deliveryDays} ${service.deliveryDays === 1 ? 'day' : 'days'}`
              : `Entrega: ${service.deliveryDays} ${service.deliveryDays === 1 ? 'día' : 'días'}`}
          </span>
          <span className="flex items-center gap-1 text-accent">
            <Shield className="h-3.5 w-3.5" />
            {language === 'en' ? 'Protected Escrow' : 'Escrow protegido'}
          </span>
        </div>

        {/* Price & Book Button */}
        <div className="mt-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400">
              {language === 'en' ? 'Total price' : 'Precio total'}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-white">
                {service.priceUsdc}
              </span>
              <span className="text-xs font-semibold text-usdc">USDC</span>
            </div>
          </div>

          <button
            onClick={() => onBook(service)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover shadow-md shadow-primary/20 active:scale-95"
          >
            {language === 'en' ? 'Hire' : 'Contratar'}
          </button>
        </div>
      </div>
    </div>
  );
}

