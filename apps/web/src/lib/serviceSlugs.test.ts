import { describe, expect, it } from 'vitest';
import { SERVICE_SLUG_RENAMES, serviceSlugCandidates } from './serviceSlugs';
import { isTestRequest } from './requests';

describe('service slug renames', () => {
  it('looks a service up by its new or old slug', () => {
    const [oldSlug, newSlug] = Object.entries(SERVICE_SLUG_RENAMES)[0];
    expect(serviceSlugCandidates(newSlug)).toEqual([newSlug, oldSlug]);
    expect(serviceSlugCandidates(oldSlug)).toEqual([oldSlug, newSlug]);
    expect(serviceSlugCandidates('other')).toEqual(['other']);
  });
  it('uses lowercase ASCII slugs', () => {
    for (const s of Object.values(SERVICE_SLUG_RENAMES)) expect(s).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('isTestRequest', () => {
  it('flags internal test requests only', () => {
    expect(isTestRequest({ slug: 'prueba-interna-verificacion-del-flujo-de-pago-mve2euyc' })).toBe(true);
    expect(isTestRequest({ slug: 'x', title: 'Prueba interna: flujo' })).toBe(true);
    expect(isTestRequest({ slug: 'validate-50-companies-abc', title: 'Validate 50 companies' })).toBe(false);
  });
});
