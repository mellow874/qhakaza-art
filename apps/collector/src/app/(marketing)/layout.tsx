import { CollectorHeader } from '@/components/collector/collector-chrome';
import { CollectorFooter } from '@/components/collector/collector-footer';

/**
 * The Collector Intelligence Suite is a light sub-brand with its own chrome.
 *
 * `theme-light` flips the design tokens for this whole subtree, which is why
 * the shared components (Button, Field, EditorialImage…) work unchanged in both
 * sites — they reference role-named tokens, not colours. Individual bands opt
 * back into `theme-dark`.
 */
export default function CollectorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-light bg-canvas text-body flex min-h-svh flex-col">
      <CollectorHeader />
      <div className="flex-1">{children}</div>
      <CollectorFooter />
    </div>
  );
}
