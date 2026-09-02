'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { auth } from '@qhakaza/shared-auth/server';

import { commandCentreActor, isFailure, performAudited, readAs } from '@/lib/audit';

/**
 * The configurable lists.
 *
 * WHY THESE ARE TABLES AND NOT ENUMS. The brief requires Qhakaza to extend the
 * vocabulary without a developer and a deployment. An enum change is a
 * migration; a row is an afternoon.
 *
 * ADMIN ONLY, not advisors. These lists are the SHAPE of the record: adding an
 * exhibition type changes what every future assessment is comparing. That is a
 * decision with an owner.
 *
 * NOTHING IS DELETABLE. A term that has been used is part of the rows that
 * used it - deleting it would either fail on the foreign key or orphan a fact.
 * Retiring sets `active = false`, which removes it from the pickers and leaves
 * history legible.
 */

export type ListResult = { ok: true } | { ok: false; error: string };

/** The lists an admin may edit. The value is unused at runtime - the switches
 * below name their models directly - but the keys are the closed set every
 * schema here validates against. */
const LISTS = {
  medium: 'medium',
  exhibitionType: 'exhibitionType',
  signalType: 'signalType',
  cvEntryType: 'cvEntryType',
  representationType: 'representationType',
  documentType: 'documentType',
  readinessCriterion: 'readinessCriterion',
} as const;

export type ListName = keyof typeof LISTS;

const termSchema = z.object({
  list: z.enum(Object.keys(LISTS) as [ListName, ...ListName[]]),
  label: z.string().trim().min(1, 'A term needs a label').max(200),
  /**
   * Derived from the label when not given. Slugs are referenced by seeded rows
   * and by any integration, so an existing one is never rewritten - only new
   * terms get one minted.
   */
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'Use lower-case letters, numbers and hyphens')
    .max(80)
    .optional(),
  guidance: z.string().trim().max(1_000).optional(),
  family: z.string().trim().max(120).optional(),
  ordering: z.number().int().min(0).max(10_000).optional(),
});

const slugify = (label: string) =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

export async function addTerm(input: unknown): Promise<ListResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };
  if (actor.role !== 'ADMIN') {
    return { ok: false, error: 'Only an administrator can change these lists.' };
  }

  const parsed = termSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'INVALID' };
  }

  const { list, label, guidance, family, ordering } = parsed.data;
  const slug = parsed.data.slug ?? slugify(label);

  if (!slug) return { ok: false, error: 'That label does not make a usable slug.' };

  try {
    await performAudited({
      actor,
      action: 'vocabulary.add',
      entityType: list,
      summary: `${label} added to ${list}`,
      after: { slug, label },
      run: async (tx) => {
        /*
         * WRITTEN OUT PER LIST, deliberately.
         *
         * These models do not carry the same columns - only Medium has
         * `family`, and three of the seven have no `guidance`. A single
         * dynamic `tx[model].create({ data })` compiles only with the types
         * turned off, and then a field the model lacks fails at runtime in
         * front of whoever was adding a term.
         *
         * The same reasoning as `actorContext` in lib/audit.ts: an exhaustive
         * switch means the next list added fails to compile here rather than
         * quietly taking the wrong shape.
         */
        const common = { slug, label, ordering: ordering ?? 999, createdById: actor.userId };

        switch (list) {
          case 'medium':
            await tx.medium.create({ data: { ...common, family: family ?? null } });
            break;
          case 'exhibitionType':
            await tx.exhibitionType.create({ data: { ...common, guidance: guidance ?? null } });
            break;
          case 'signalType':
            await tx.signalType.create({ data: { ...common, guidance: guidance ?? null } });
            break;
          case 'cvEntryType':
            await tx.cvEntryType.create({ data: common });
            break;
          case 'representationType':
            await tx.representationType.create({ data: common });
            break;
          case 'documentType':
            await tx.documentType.create({ data: { ...common, guidance: guidance ?? null } });
            break;
          case 'readinessCriterion':
            await tx.readinessCriterion.create({
              data: { ...common, guidance: guidance ?? null },
            });
            break;
        }
      },
    });
  } catch (error) {
    console.error('addTerm failed', error);
    // The commonest failure by far, and worth saying plainly.
    return { ok: false, error: 'That term already exists, or the slug is taken.' };
  }

  revalidatePath('/lists');
  return { ok: true };
}

const retireSchema = z.object({
  list: z.enum(Object.keys(LISTS) as [ListName, ...ListName[]]),
  id: z.string().min(1),
  active: z.boolean(),
});

/** Retire a term, or bring it back. Never deletes. */
export async function setTermActive(input: unknown): Promise<ListResult> {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return { ok: false, error: actor.error };
  if (actor.role !== 'ADMIN') {
    return { ok: false, error: 'Only an administrator can change these lists.' };
  }

  const parsed = retireSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'INVALID' };

  const { list, id, active } = parsed.data;

  try {
    await performAudited({
      actor,
      action: active ? 'vocabulary.restore' : 'vocabulary.retire',
      entityType: list,
      entityId: id,
      summary: `${list} term ${active ? 'restored' : 'retired'}`,
      after: { active },
      run: async (tx) => {
        // Exhaustive for the same reason as addTerm.
        const where = { id };
        const data = { active };

        switch (list) {
          case 'medium':
            await tx.medium.update({ where, data });
            break;
          case 'exhibitionType':
            await tx.exhibitionType.update({ where, data });
            break;
          case 'signalType':
            await tx.signalType.update({ where, data });
            break;
          case 'cvEntryType':
            await tx.cvEntryType.update({ where, data });
            break;
          case 'representationType':
            await tx.representationType.update({ where, data });
            break;
          case 'documentType':
            await tx.documentType.update({ where, data });
            break;
          case 'readinessCriterion':
            await tx.readinessCriterion.update({ where, data });
            break;
        }
      },
    });
  } catch (error) {
    console.error('setTermActive failed', error);
    return { ok: false, error: 'UNKNOWN' };
  }

  revalidatePath('/lists');
  return { ok: true };
}

/** Every list, including retired terms, for the management screen. */
export async function getAllLists() {
  const actor = commandCentreActor(await auth());
  if (isFailure(actor)) return null;

  return readAs(actor, async (tx) => {
    const [
      mediums,
      exhibitionTypes,
      signalTypes,
      cvEntryTypes,
      representationTypes,
      documentTypes,
      readinessCriteria,
    ] = await Promise.all([
      tx.medium.findMany({ orderBy: { ordering: 'asc' } }),
      tx.exhibitionType.findMany({ orderBy: { ordering: 'asc' } }),
      tx.signalType.findMany({ orderBy: { ordering: 'asc' } }),
      tx.cvEntryType.findMany({ orderBy: { ordering: 'asc' } }),
      tx.representationType.findMany({ orderBy: { ordering: 'asc' } }),
      tx.documentType.findMany({ orderBy: { ordering: 'asc' } }),
      tx.readinessCriterion.findMany({ orderBy: { ordering: 'asc' } }),
    ]);

    return {
      medium: mediums,
      exhibitionType: exhibitionTypes,
      signalType: signalTypes,
      cvEntryType: cvEntryTypes,
      representationType: representationTypes,
      documentType: documentTypes,
      readinessCriterion: readinessCriteria,
    };
  });
}
