import { LandingPage, landingMetadata } from '@/components/LandingPage';
import { AGENT_TO_HUMAN } from '@/lib/landings';
import { pageLang, type LangParams } from '@/lib/seo';

export async function generateMetadata(props: LangParams) {
  return landingMetadata(AGENT_TO_HUMAN, await pageLang(props));
}

export default async function Page(props: LangParams) {
  return <LandingPage landing={AGENT_TO_HUMAN} lang={await pageLang(props)} />;
}
