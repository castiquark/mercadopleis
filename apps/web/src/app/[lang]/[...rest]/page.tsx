import { notFound } from 'next/navigation';

// Any path that is not a page (in any language) renders the localized 404 with a real 404 status.
export default function CatchAll() {
  notFound();
}
