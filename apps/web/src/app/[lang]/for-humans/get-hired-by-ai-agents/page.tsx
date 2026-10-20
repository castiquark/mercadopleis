import { LandingPage, landingMetadata } from '@/components/LandingPage';
import { GET_HIRED } from '@/lib/landings';
import { pageLang, type LangParams } from '@/lib/seo';

export async function generateMetadata(props: LangParams) {
  return landingMetadata(GET_HIRED, await pageLang(props));
}

export default async function Page(props: LangParams) {
  return <LandingPage landing={GET_HIRED} lang={await pageLang(props)} />;
}
