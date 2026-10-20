'use client';

import React from 'react';
import NextLink from 'next/link';
import { useLanguage } from '@/lib/languageContext';

type Props = React.ComponentProps<typeof NextLink>;

/** next/link that keeps the current language: href="/requests" goes to /es/requests on the Spanish site. */
export default function LocaleLink({ href, ...rest }: Props) {
  const { lp } = useLanguage();
  const localized = typeof href === 'string' ? lp(href) : href;
  return <NextLink href={localized} {...rest} />;
}
