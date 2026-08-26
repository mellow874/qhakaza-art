import { prisma } from '@qhakaza/shared-db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => vi.fn());
vi.mock('@qhakaza/shared-auth/server', () => ({ auth }));
vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '203.0.113.5']]) as unknown as Headers,
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const {
  addFaqCategory,
  getContentForAdmin,
  publishLegalVersion,
  saveBriefing,
  saveFaqItem,
  saveNewsArticle,
  setFaqPublished,
} = await import('./actions');

/**
 * Editing what the public sites say.
 *
 * Two things are worth asserting hard here: that placeholder copy stops being
 * placeholder copy the moment Qhakaza writes over it, and that publishing new
 * terms never destroys the old ones.
 */

const rand = () => Math.random().toString(36).slice(2, 10);

let categoryId = '';

async function asRole(role: 'ADMIN' | 'ADVISOR') {
  const user = await prisma.user.create({
    data: { email: `${role.toLowerCase()}-${rand()}@test.local`, role },
  });
  auth.mockResolvedValue({ user: { id: user.id, role } });
  return user.id;
}

beforeEach(async () => {
  await prisma.faqItem.deleteMany();
  await prisma.faqCategory.deleteMany();
  await prisma.briefingRelation.deleteMany();
  await prisma.briefing.deleteMany();
  await prisma.newsArticle.deleteMany();
  await prisma.legalDocumentVersion.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  const category = await prisma.faqCategory.create({
    data: { slug: `general-${rand()}`, label: 'General', ordering: 1 },
  });
  categoryId = category.id;

  await asRole('ADMIN');
});

describe('placeholder copy', () => {
  it('is counted so it cannot be quietly forgotten', async () => {
    await prisma.faqItem.create({
      data: {
        categoryId,
        question: 'A question we invented',
        answer: 'An answer we invented',
        isDemo: true,
        published: true,
      },
    });

    const content = await getContentForAdmin();
    expect(content?.demoCount).toBe(1);
  });

  it('stops being placeholder the moment Qhakaza writes over it', async () => {
    /*
     * The flag clears on the way past rather than needing a separate "mark as
     * reviewed" step that nobody would remember to press.
     */
    const item = await prisma.faqItem.create({
      data: {
        categoryId,
        question: 'A question we invented',
        answer: 'An answer we invented',
        isDemo: true,
      },
    });

    await saveFaqItem({
      id: item.id,
      categoryId,
      question: 'What does Qhakaza actually do?',
      answer: "Qhakaza's own words.",
      published: true,
    });

    const after = await prisma.faqItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(after.isDemo).toBe(false);
    expect(after.answer).toBe("Qhakaza's own words.");
    expect((await getContentForAdmin())?.demoCount).toBe(0);
  });
});

describe('the FAQ', () => {
  it('is created hidden unless explicitly published', async () => {
    // Nothing reaches the public site by being typed.
    await saveFaqItem({ categoryId, question: 'A question', answer: 'An answer' });

    const item = await prisma.faqItem.findFirstOrThrow();
    expect(item.published).toBe(false);
  });

  it('can be published and hidden again', async () => {
    await saveFaqItem({ categoryId, question: 'A question', answer: 'An answer' });
    const item = await prisma.faqItem.findFirstOrThrow();

    await setFaqPublished({ id: item.id, published: true });
    expect((await prisma.faqItem.findUniqueOrThrow({ where: { id: item.id } })).published).toBe(
      true,
    );

    await setFaqPublished({ id: item.id, published: false });
    expect((await prisma.faqItem.findUniqueOrThrow({ where: { id: item.id } })).published).toBe(
      false,
    );
  });

  it('refuses an empty answer', async () => {
    const result = await saveFaqItem({ categoryId, question: 'A question', answer: '   ' });

    expect(result.ok).toBe(false);
    expect(await prisma.faqItem.count()).toBe(0);
  });

  it('lets an advisor write one', async () => {
    // Editorial work. Advisors do it; the RLS matrix grants it.
    await asRole('ADVISOR');

    const result = await saveFaqItem({ categoryId, question: 'A question', answer: 'An answer' });
    expect(result.ok).toBe(true);
  });

  it('refuses an advisor adding a category', async () => {
    // A category is structure rather than copy.
    await asRole('ADVISOR');

    const result = await addFaqCategory({ label: 'A new section' });
    expect(result.ok).toBe(false);
  });
});

describe('briefings', () => {
  it('records where the claims come from', async () => {
    const result = await saveBriefing({
      title: 'The South African secondary market',
      excerpt: 'A summary.',
      body: 'The body.',
      sources: 'Auction results, 2019-2025',
      status: 'PUBLISHED',
    });

    expect(result.ok).toBe(true);
    const briefing = await prisma.briefing.findFirstOrThrow();
    expect(briefing.sources).toContain('Auction results');
    expect(briefing.publishedAt).not.toBeNull();
  });

  it('keeps its original publication date when edited', async () => {
    // A republished briefing that resets its date reads as new work.
    await saveBriefing({ title: 'A briefing', excerpt: 'A summary.', status: 'PUBLISHED' });
    const first = await prisma.briefing.findFirstOrThrow();

    await saveBriefing({
      id: first.id,
      title: 'A briefing',
      excerpt: 'A corrected summary.',
      status: 'PUBLISHED',
    });

    const after = await prisma.briefing.findUniqueOrThrow({ where: { id: first.id } });
    expect(after.publishedAt?.getTime()).toBe(first.publishedAt?.getTime());
    expect(after.excerpt).toBe('A corrected summary.');
  });

  it('is a draft unless published', async () => {
    await saveBriefing({ title: 'A briefing', excerpt: 'A summary.' });

    const briefing = await prisma.briefing.findFirstOrThrow();
    expect(briefing.status).toBe('DRAFT');
    expect(briefing.publishedAt).toBeNull();
  });
});

describe('legal documents', () => {
  it('publishes a version and archives the one it replaces', async () => {
    await publishLegalVersion({
      documentKey: 'TERMS',
      versionNumber: '1.0',
      title: 'Terms of service',
      body: 'The first terms.',
      effectiveFrom: '2026-01-01',
      publish: true,
    });

    await publishLegalVersion({
      documentKey: 'TERMS',
      versionNumber: '2.0',
      title: 'Terms of service',
      body: 'The second terms.',
      effectiveFrom: '2026-09-01',
      publish: true,
    });

    const versions = await prisma.legalDocumentVersion.findMany({
      where: { documentKey: 'TERMS' },
      orderBy: { versionNumber: 'asc' },
    });

    expect(versions).toHaveLength(2);
    // The old one survives, exactly as it was.
    expect(versions[0].status).toBe('ARCHIVED');
    expect(versions[0].body).toBe('The first terms.');
    expect(versions[1].status).toBe('PUBLISHED');
  });

  it('leaves the privacy policy alone when terms are published', async () => {
    await publishLegalVersion({
      documentKey: 'PRIVACY',
      versionNumber: '1.0',
      title: 'Privacy policy',
      body: 'The policy.',
      effectiveFrom: '2026-01-01',
      publish: true,
    });

    await publishLegalVersion({
      documentKey: 'TERMS',
      versionNumber: '1.0',
      title: 'Terms',
      body: 'The terms.',
      effectiveFrom: '2026-01-01',
      publish: true,
    });

    const privacy = await prisma.legalDocumentVersion.findFirstOrThrow({
      where: { documentKey: 'PRIVACY' },
    });
    expect(privacy.status).toBe('PUBLISHED');
  });

  it('refuses a duplicate version number', async () => {
    const input = {
      documentKey: 'TERMS' as const,
      versionNumber: '1.0',
      title: 'Terms',
      body: 'The terms.',
      effectiveFrom: '2026-01-01',
    };

    await publishLegalVersion(input);
    const result = await publishLegalVersion(input);

    expect(result.ok).toBe(false);
    expect(await prisma.legalDocumentVersion.count()).toBe(1);
  });

  it('refuses an advisor', async () => {
    await asRole('ADVISOR');

    const result = await publishLegalVersion({
      documentKey: 'TERMS',
      versionNumber: '1.0',
      title: 'Terms',
      body: 'The terms.',
      effectiveFrom: '2026-01-01',
    });

    expect(result.ok).toBe(false);
    expect(await prisma.legalDocumentVersion.count()).toBe(0);
  });
});

describe('news', () => {
  it('is administrator-only', async () => {
    await asRole('ADVISOR');

    const result = await saveNewsArticle({
      title: 'An announcement',
      category: 'Programme',
      excerpt: 'A summary.',
    });

    expect(result.ok).toBe(false);
  });

  it('records an announcement', async () => {
    const result = await saveNewsArticle({
      title: 'An announcement',
      category: 'Programme',
      excerpt: 'A summary.',
      status: 'PUBLISHED',
    });

    expect(result.ok).toBe(true);
    const article = await prisma.newsArticle.findFirstOrThrow();
    expect(article.slug).toBe('an-announcement');
    expect(article.publishedAt).not.toBeNull();
  });
});

describe('every change is audited', () => {
  it('records who changed what', async () => {
    await saveFaqItem({ categoryId, question: 'A question', answer: 'An answer' });

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'content.faq.create' },
    });
    expect(entry.entityType).toBe('FaqItem');
    expect(entry.actorRole).toBe('ADMIN');
  });
});
