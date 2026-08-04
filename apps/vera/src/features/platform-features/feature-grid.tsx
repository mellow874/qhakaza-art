import {
  BookOpen,
  CircleCheck,
  FileText,
  Image as ImageIcon,
  LayoutGrid,
  User,
  type LucideIcon,
} from 'lucide-react';

import type { FeatureIcon } from '@/content/features';

const ICONS: Record<FeatureIcon, LucideIcon> = {
  profile: User,
  artwork: ImageIcon,
  documentation: FileText,
  completeness: CircleCheck,
  dashboard: LayoutGrid,
  news: BookOpen,
};

export type Feature = {
  icon: FeatureIcon;
  title: string;
  body: string;
};

/**
 * Two-column feature list. Each icon is decorative — it restates the heading
 * beside it, so it is hidden from assistive tech rather than announced twice.
 */
export function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <ul className="grid gap-x-16 gap-y-16 md:grid-cols-2">
      {features.map((feature) => {
        const Icon = ICONS[feature.icon];

        return (
          <li key={feature.title} className="flex gap-5">
            <Icon
              aria-hidden="true"
              strokeWidth={1.25}
              className="text-accent mt-1.5 h-5 w-5 shrink-0"
            />

            <div className="flex flex-col gap-4">
              <h2 className="text-2xl leading-snug">{feature.title}</h2>
              <p className="text-body leading-relaxed">{feature.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
