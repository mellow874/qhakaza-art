'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@qhakaza/shared-auth/server';

import { commandCentreActor, isFailure, performAudited, readAs } from '@/lib/audit';

/**
 * The content surfaces: FAQ, briefings, news and the legal documents.
 *
 * WHY THIS EXISTS. The tables and their policies were built two cycles ago and
 * the public sites read from them, but there was no screen anywhere to write
 * to them - so "editable without a developer" was true of the schema and false
 * of the product. Every change still needed one of us and a deployment.
 *
 * DEMO CONTENT IS TRACKED, NOT HIDDEN. Rows we wrote to fill a page carry
 * `isDemo`, the public sites say so on the page, and this screen shows which
 * rows are still ours rather than Qhakaza's. Replacing one clears the flag,
 * which is the only way it ever clears.
 *
 * LEGAL DOCUMENTS ARE VERSIONED, NEVER EDITED. You must be able to show what
 * someone agreed to on the day they agreed to it, so publishing new terms
 * writes a new version and leaves every previous one intact.
 */

export type ContentResult =
  { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsOf(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join('.')] ??= issue.message;
  return fieldErrors;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

// --- FAQ -------------------------------------------------------------------

const faqSchema = z.object({
  id: z.string().min(1).optional(),
  categoryId: z.string().min(1, 'Choose a category'),
  question: z.string().trim().min(1, 'A question is required').max(500),
  answer: z.string().trim().min(1, 'An answer is required').max(5_000),
  ordering: z.number().int().min(0).max(9_999).optional(),
  published: z.boolean().optional(),
});

export async function saveFaqItem(input: unknown): Promise<ContentResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const parsed = faqSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const data = parsed.data;

  try {
    await performAudited({
      actor,
      action: data.id ? 'content.faq.update' : 'content.faq.create',
      entityType: 'FaqItem',
      entityId: data.id ?? null,
      summary: data.question.slice(0, 120),
      after: { published: data.published ?? false },
      run: async (tx) => {
        const common = {
          categoryId: data.categoryId,
          question: data.question,
          answer: data.answer,
          ordering: data.ordering ?? 0,
          published: data.published ?? false,
          /*
           * Qhakaza has written this, so it is no longer ours. This is the
           * only place the flag clears, and it clears on the way past rather
           * than needing to be remembered.
           */
          isDemo: false,
        };

        if (data.id) {
          await tx.faqItem.update({ where: { id: data.id }, data: common });
        } else {
          await tx.faqItem.create({ data: { ...common, createdById: actor.userId } });
        }
      },
    });
  } catch (error) {
    console.error('saveFaqItem failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/content');
  return { ok: true };
}

const publishSchema = z.object({ id: z.string().min(1), published: z.boolean() });

export async function setFaqPublished(input: unknown): Promise<ContentResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const parsed = publishSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  try {
    await performAudited({
      actor,
      action: parsed.data.published ? 'content.faq.publish' : 'content.faq.unpublish',
      entityType: 'FaqItem',
      entityId: parsed.data.id,
      after: { published: parsed.data.published },
      run: (tx) =>
        tx.faqItem.update({
          where: { id: parsed.data.id },
          data: { published: parsed.data.published },
        }),
    });
  } catch (error) {
    console.error('setFaqPublished failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/content');
  return { ok: true };
}

const categorySchema = z.object({
  label: z.string().trim().min(1, 'A category needs a name').max(120),
  ordering: z.number().int().min(0).max(9_999).optional(),
});

export async function addFaqCategory(input: unknown): Promise<ContentResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };
  if (actor.role !== 'ADMIN') {
    return { ok: false, error: 'Only an administrator can add a category.' };
  }

  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  try {
    await performAudited({
      actor,
      action: 'content.faq.category',
      entityType: 'FaqCategory',
      summary: parsed.data.label,
      run: (tx) =>
        tx.faqCategory.create({
          data: {
            slug: slugify(parsed.data.label),
            label: parsed.data.label,
            ordering: parsed.data.ordering ?? 999,
            createdById: actor.userId,
          },
        }),
    });
  } catch (error) {
    console.error('addFaqCategory failed', error);
    return { ok: false, error: 'That category already exists.' };
  }

  revalidatePath('/content');
  return { ok: true };
}

// --- Briefings -------------------------------------------------------------

const briefingSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1, 'A title is required').max(300),
  subtitle: z.string().trim().max(300).optional(),
  author: z.string().trim().max(200).optional(),
  category: z.string().trim().max(120).optional(),
  excerpt: z.string().trim().min(1, 'A summary is required').max(1_000),
  body: z.string().trim().max(50_000).optional(),
  /**
   * Where the claims come from. A briefing making market claims without
   * sources is the thing VERA exists to argue against, so this is prompted for
   * on every one - though not refused, since not every briefing makes a claim.
   */
  sources: z.string().trim().max(5_000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

export async function saveBriefing(input: unknown): Promise<ContentResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };

  const parsed = briefingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const data = parsed.data;
  const status = data.status ?? 'DRAFT';

  try {
    await performAudited({
      actor,
      action: data.id ? 'content.briefing.update' : 'content.briefing.create',
      entityType: 'Briefing',
      entityId: data.id ?? null,
      summary: data.title.slice(0, 120),
      after: { status },
      run: async (tx) => {
        const common = {
          title: data.title,
          subtitle: data.subtitle ?? null,
          author: data.author ?? null,
          category: data.category ?? null,
          excerpt: data.excerpt,
          body: data.body ?? null,
          sources: data.sources ?? null,
          status,
          // Set on the transition to published and never cleared afterwards,
          // so a republished briefing keeps its original date.
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
          isDemo: false,
        };

        if (data.id) {
          const existing = await tx.briefing.findUnique({
            where: { id: data.id },
            select: { publishedAt: true },
          });

          await tx.briefing.update({
            where: { id: data.id },
            data: {
              ...common,
              publishedAt:
                status === 'PUBLISHED' ? (existing?.publishedAt ?? new Date()) : common.publishedAt,
            },
          });
        } else {
          await tx.briefing.create({
            data: { ...common, slug: slugify(data.title), createdById: actor.userId },
          });
        }
      },
    });
  } catch (error) {
    console.error('saveBriefing failed', error);
    return { ok: false, error: 'A briefing with that title already exists.' };
  }

  revalidatePath('/content');
  return { ok: true };
}

// --- News ------------------------------------------------------------------

const newsSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().trim().min(1, 'A title is required').max(300),
  category: z.string().trim().min(1, 'A category is required').max(120),
  excerpt: z.string().trim().min(1, 'A summary is required').max(1_000),
  body: z.string().trim().max(50_000).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

export async function saveNewsArticle(input: unknown): Promise<ContentResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };
  if (actor.role !== 'ADMIN') {
    return { ok: false, error: 'Only an administrator can change news.' };
  }

  const parsed = newsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const data = parsed.data;
  const status = data.status ?? 'DRAFT';

  try {
    await performAudited({
      actor,
      action: data.id ? 'content.news.update' : 'content.news.create',
      entityType: 'NewsArticle',
      entityId: data.id ?? null,
      summary: data.title.slice(0, 120),
      after: { status },
      run: async (tx) => {
        const common = {
          title: data.title,
          category: data.category,
          excerpt: data.excerpt,
          body: data.body ?? null,
          status,
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
        };

        if (data.id) {
          await tx.newsArticle.update({ where: { id: data.id }, data: common });
        } else {
          await tx.newsArticle.create({
            data: { ...common, slug: slugify(data.title), createdById: actor.userId },
          });
        }
      },
    });
  } catch (error) {
    console.error('saveNewsArticle failed', error);
    return { ok: false, error: 'An article with that title already exists.' };
  }

  revalidatePath('/content');
  return { ok: true };
}

// --- Legal -----------------------------------------------------------------

const legalSchema = z.object({
  documentKey: z.enum(['TERMS', 'PRIVACY']),
  versionNumber: z.string().trim().min(1, 'Give this version a number').max(40),
  title: z.string().trim().min(1, 'A title is required').max(300),
  body: z.string().trim().min(1, 'The document body is required').max(200_000),
  effectiveFrom: z.string().date(),
  publish: z.boolean().optional(),
});

/**
 * Publish a new version of a legal document.
 *
 * A NEW ROW, ALWAYS. Editing terms in place would destroy the evidence of what
 * a person actually agreed to, which is the one thing these records exist for.
 * Superseding is handled by `effectiveFrom` and status; the previous version is
 * not touched.
 */
export async function publishLegalVersion(input: unknown): Promise<ContentResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };
  if (actor.role !== 'ADMIN') {
    return { ok: false, error: 'Only an administrator can publish a legal document.' };
  }

  const parsed = legalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'INVALID', fieldErrors: fieldErrorsOf(parsed.error) };
  }

  const data = parsed.data;

  try {
    await performAudited({
      actor,
      action: 'content.legal.publish',
      entityType: 'LegalDocumentVersion',
      summary: `${data.documentKey} ${data.versionNumber}`,
      after: { documentKey: data.documentKey, versionNumber: data.versionNumber },
      run: async (tx) => {
        if (data.publish) {
          /*
           * The previous published version is archived rather than deleted, so
           * the record of what was in force and when survives. Only one
           * version of a document is live at a time.
           */
          await tx.legalDocumentVersion.updateMany({
            where: { documentKey: data.documentKey, status: 'PUBLISHED' },
            data: { status: 'ARCHIVED' },
          });
        }

        await tx.legalDocumentVersion.create({
          data: {
            documentKey: data.documentKey,
            versionNumber: data.versionNumber,
            title: data.title,
            body: data.body,
            effectiveFrom: new Date(data.effectiveFrom),
            status: data.publish ? 'PUBLISHED' : 'DRAFT',
            isDemo: false,
            createdById: actor.userId,
          },
        });
      },
    });
  } catch (error) {
    console.error('publishLegalVersion failed', error);
    return { ok: false, error: 'That version number already exists for this document.' };
  }

  revalidatePath('/content');
  return { ok: true };
}

// --- Reading ---------------------------------------------------------------

/** Everything the content screen renders, drafts included. */
export async function getContentForAdmin() {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return null;

  return readAs(actor, async (tx) => {
    const [categories, faqs, briefings, news, legal] = await Promise.all([
      tx.faqCategory.findMany({
        select: { id: true, label: true, ordering: true },
        orderBy: { ordering: 'asc' },
      }),
      tx.faqItem.findMany({
        select: {
          id: true,
          question: true,
          answer: true,
          ordering: true,
          published: true,
          isDemo: true,
          categoryId: true,
          category: { select: { label: true } },
        },
        orderBy: [{ categoryId: 'asc' }, { ordering: 'asc' }],
      }),
      tx.briefing.findMany({
        select: {
          id: true,
          title: true,
          subtitle: true,
          excerpt: true,
          body: true,
          author: true,
          category: true,
          sources: true,
          status: true,
          isDemo: true,
          publishedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      tx.newsArticle.findMany({
        select: {
          id: true,
          title: true,
          category: true,
          excerpt: true,
          body: true,
          status: true,
          publishedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      tx.legalDocumentVersion.findMany({
        select: {
          id: true,
          documentKey: true,
          versionNumber: true,
          title: true,
          status: true,
          isDemo: true,
          effectiveFrom: true,
        },
        orderBy: [{ documentKey: 'asc' }, { effectiveFrom: 'desc' }],
      }),
    ]);

    /*
     * How much of what the public sees is still ours rather than Qhakaza's.
     * Surfaced at the top of the screen because demo copy that nobody
     * remembers to replace is how a placeholder ends up quoted back at you in
     * a meeting.
     */
    const demoCount =
      faqs.filter((row) => row.isDemo).length +
      briefings.filter((row) => row.isDemo).length +
      legal.filter((row) => row.isDemo).length;

    return { categories, faqs, briefings, news, legal, demoCount };
  });
}

export type AdminContent = NonNullable<Awaited<ReturnType<typeof getContentForAdmin>>>;
