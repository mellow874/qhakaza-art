/**
 * The 13 core entities.
 *
 * These are shared by all three applications and are never duplicated or forked
 * per app. Vera, the Collector Platform and the Command Center all read and
 * write these same tables through this package.
 *
 * `CORE_ENTITIES` is the canonical list in code, not just in prose — the RLS
 * matrix in `rls.ts` is keyed by it, so an entity added there without a policy
 * fails to typecheck rather than silently shipping unprotected.
 */

export const CORE_ENTITIES = [
  'Membership',
  'CollectorIntake',
  'CollectorVerification',
  'MemberInvitation',
  'InvitationRecipientType',
  'MediaAsset',
  'InternalNote',
  'InternalNoteRevision',
  'ArtworkReviewRequest',

  // VERA
  'EvidenceType',
  'ReliabilityLevel',
  'GapType',
  'SpecialistCategory',
  'PartyRole',
  'Party',
  'Exhibition',
  'Publication',
  'ProvenanceTransaction',
  'Source',
  'Evidence',
  'Claim',
  'Assessment',
  'Gap',
  'Contradiction',
  'SpecialistEscalation',
  'MethodologyVersion',
  'IntelligenceCase',
  'CaseVersion',
  'CaseArtwork',
  'CaseEvidence',
  'EvidenceClaim',
  'ClaimAssessment',
  'ArtworkParty',
  'CaseParty',
  'EvidenceSource',
  'ArtworkExhibition',
  'ArtworkPublication',
  'Artist',
  'Artwork',
  'NewsArticle',
  'PrivateNoteSubmission',
  'AnalyticsEvent',
  'DailyMetric',
  'AuditLog',
  'ActivationAttempt',
  'Partner',
] as const;

export type CoreEntity = (typeof CORE_ENTITIES)[number];

/**
 * Which side of the platform each entity belongs to.
 *
 * `supply` — created and owned by artists via Vera.
 * `collector` — private. Public artist users must never read or write these.
 * `platform` — operational: audit, analytics, editorial, partners.
 */
export const ENTITY_DOMAIN = {
  Artist: 'supply',
  Artwork: 'supply',

  Membership: 'collector',
  CollectorIntake: 'collector',
  CollectorVerification: 'collector',
  MemberInvitation: 'collector',
  // Not collector-only: artist invitations use it too, and the list of
  // types is reference data rather than anyone's personal information.
  InvitationRecipientType: 'platform',
  // Spans both sides: artwork photographs are supply-side, evidence
  // documents are internal. The row's own confidentiality decides.
  MediaAsset: 'platform',
  // Staff writing to staff. Never readable outside Qhakaza.
  InternalNote: 'platform',
  InternalNoteRevision: 'platform',
  // The artist must be able to read the question asked of them.
  ArtworkReviewRequest: 'supply',

  // VERA. All internal: evidence, reasoning and Cases are Qhakaza's own
  // working record, and none of it is client-facing.
  EvidenceType: 'platform',
  ReliabilityLevel: 'platform',
  GapType: 'platform',
  SpecialistCategory: 'platform',
  PartyRole: 'platform',
  Party: 'platform',
  Exhibition: 'platform',
  Publication: 'platform',
  ProvenanceTransaction: 'platform',
  Source: 'platform',
  Evidence: 'platform',
  Claim: 'platform',
  Assessment: 'platform',
  Gap: 'platform',
  Contradiction: 'platform',
  SpecialistEscalation: 'platform',
  MethodologyVersion: 'platform',
  IntelligenceCase: 'platform',
  CaseVersion: 'platform',
  CaseArtwork: 'platform',
  CaseEvidence: 'platform',
  EvidenceClaim: 'platform',
  ClaimAssessment: 'platform',
  ArtworkParty: 'platform',
  CaseParty: 'platform',
  EvidenceSource: 'platform',
  ArtworkExhibition: 'platform',
  ArtworkPublication: 'platform',
  ActivationAttempt: 'collector',
  PrivateNoteSubmission: 'collector',

  NewsArticle: 'platform',
  AnalyticsEvent: 'platform',
  DailyMetric: 'platform',
  AuditLog: 'platform',
  Partner: 'platform',
} as const satisfies Record<CoreEntity, 'supply' | 'collector' | 'platform'>;

/** Entities Vera must never be able to touch, in any way, at all. */
export const COLLECTOR_ONLY_ENTITIES = CORE_ENTITIES.filter(
  (entity) => ENTITY_DOMAIN[entity] === 'collector',
);

/**
 * Legacy marketplace tables. Not part of the 13, retained because this project
 * does not delete data. Superseded by the intelligence platform; no new code
 * should read or write them.
 */
export const LEGACY_ENTITIES = ['Order', 'Favorite'] as const;

// Prisma's generated types are the single source of truth for entity shape.
export type {
  ActivationAttempt,
  AnalyticsEvent,
  Artist,
  Artwork,
  AuditLog,
  CollectorIntake,
  CollectorVerification,
  ContactMessage,
  DailyMetric,
  InvitationRecipientType,
  MemberInvitation,
  Membership,
  NewsArticle,
  Partner,
  PrivateNoteSubmission,
  User,
} from '@prisma/client';

export {
  ActivationOutcome,
  ArticleStatus,
  ArtStatus,
  CollectorIntakeStatus,
  InvitationStatus,
  MembershipStatus,
  NoteStatus,
  PartnerStatus,
  Role,
  VerificationOutcome,
} from '@prisma/client';
