import { prisma } from '@qhakaza/shared-db';

/**
 * The public content surfaces, read from the database.
 *
 * These replace `content/faq.ts` and `content/briefings.ts`, which were
 * TypeScript files only a developer could change. Section 18-20 asks for all
 * three to be editable without a deployment, and that is the whole point.
 *
 * Every query filters on published state. The RLS policies do the same, so a
 * mistake here cannot leak a draft on its own -- but a query that returned
 * drafts would still be a bug, and the two agreeing is deliberate.
 */

/** Whether any published content is still demonstration text. */
export async function hasDemoContent(): Promise<boolean> {
  const [faq, briefings, legal] = await Promise.all([
    prisma.faqItem.count({ where: { published: true, isDemo: true } }),
    prisma.briefing.count({ where: { status: 'PUBLISHED', isDemo: true } }),
    prisma.legalDocumentVersion.count({ where: { status: 'PUBLISHED', isDemo: true } }),
  ]);

  return faq + briefings + legal > 0;
}

/** FAQ, grouped by category, published only, in the order staff set. */
export async function getFaq() {
  const categories = await prisma.faqCategory.findMany({
    where: { active: true, items: { some: { published: true } } },
    orderBy: { ordering: 'asc' },
    select: {
      id: true,
      label: true,
      items: {
        where: { published: true },
        orderBy: { ordering: 'asc' },
        select: { id: true, question: true, answer: true, isDemo: true },
      },
    },
  });

  return categories;
}

/** Published Briefings, newest first. */
export async function getBriefings({ limit = 50 }: { limit?: number } = {}) {
  return prisma.briefing.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      author: true,
      category: true,
      excerpt: true,
      coverImageUrl: true,
      publishedAt: true,
      isDemo: true,
    },
  });
}

/** One Briefing and the ones it points at. */
export async function getBriefingBySlug(slug: string) {
  const briefing = await prisma.briefing.findFirst({
    where: { slug, status: 'PUBLISHED' },
    select: {
      id: true,
      slug: true,
      title: true,
      subtitle: true,
      author: true,
      category: true,
      excerpt: true,
      body: true,
      sources: true,
      coverImageUrl: true,
      publishedAt: true,
      isDemo: true,
      relatedTo: {
        select: {
          to: {
            select: { slug: true, title: true, excerpt: true, status: true },
          },
        },
      },
    },
  });

  if (!briefing) return null;

  return {
    ...briefing,
    // A related Briefing that is not itself published must not be linked to.
    related: briefing.relatedTo
      .map((relation) => relation.to)
      .filter((related) => related.status === 'PUBLISHED'),
  };
}

/**
 * The document currently in force.
 *
 * The newest PUBLISHED version whose effective date has arrived. Earlier
 * versions stay in the table: section 20 requires previous-version retention,
 * because you must be able to show what someone agreed to on the day.
 */
export async function getLegalDocument(documentKey: 'TERMS' | 'PRIVACY') {
  return prisma.legalDocumentVersion.findFirst({
    where: { documentKey, status: 'PUBLISHED', effectiveFrom: { lte: new Date() } },
    orderBy: { effectiveFrom: 'desc' },
    select: {
      id: true,
      title: true,
      body: true,
      versionNumber: true,
      effectiveFrom: true,
      isDemo: true,
    },
  });
}

/** Every version of a document, so the history can be shown. */
export async function getLegalDocumentHistory(documentKey: 'TERMS' | 'PRIVACY') {
  return prisma.legalDocumentVersion.findMany({
    where: { documentKey, status: 'PUBLISHED' },
    orderBy: { effectiveFrom: 'desc' },
    select: { id: true, versionNumber: true, effectiveFrom: true },
  });
}
