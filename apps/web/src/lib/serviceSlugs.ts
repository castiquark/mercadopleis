/**
 * English slugs for the operator's five catalog services (22 Oct 2026). The old Spanish slugs redirect with a 301
 * (next.config.ts), and lookups accept both, so the deploy works before and after the database rename is applied.
 */
export const SERVICE_SLUG_RENAMES: Record<string, string> = {
  'transcripcion-audio-anotacion-datos-ia-espanol': 'spanish-audio-transcription-ai-data-annotation',
  'limpieza-preparacion-datasets-llms-jsonl': 'llm-dataset-cleaning-fine-tuning-jsonl',
  'automatizacion-flujo-n8n-make-openai': 'n8n-make-automation-openai-claude',
  'optimizacion-red-teaming-system-prompts': 'prompt-red-teaming-ai-agents',
  'script-python-web-scraping-extraccion-datos': 'python-web-scraping-structured-data',
};

const OLD_BY_NEW = Object.fromEntries(Object.entries(SERVICE_SLUG_RENAMES).map(([oldSlug, newSlug]) => [newSlug, oldSlug]));

/** The slugs a service may be stored under: the one asked for, plus its old or new slug (the API takes either). */
export function serviceSlugCandidates(slug: string): string[] {
  const other = OLD_BY_NEW[slug] ?? SERVICE_SLUG_RENAMES[slug];
  return other ? [slug, other] : [slug];
}
