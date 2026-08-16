-- Demo VERA data.
--
-- A single worked Collector Intelligence Case, so the Command Center's figures
-- and panels show something during a demonstration rather than a row of zeros.
--
-- It is a WORKED example, deliberately: two claims resting on shared evidence,
-- one contradiction left unresolved, one open gap, one specialist escalation
-- outstanding, and an issued version with a named accountable party. Those are
-- the shapes the architecture exists for, and a demo of empty tables shows
-- none of them.
--
-- Everything references demo- ids so it can be removed in three statements:
--
--   DELETE FROM "IntelligenceCase" WHERE "id" LIKE 'demo-%';
--   DELETE FROM "Evidence"         WHERE "id" LIKE 'demo-%';
--   DELETE FROM "Claim"            WHERE "id" LIKE 'demo-%';
--
-- ASCII only.

INSERT INTO "MethodologyVersion" ("id", "versionNumber", "effectiveFrom", "status", "description", "approvedBy", "updated_date")
VALUES ('demo-method-1', '1.0-demo', CURRENT_TIMESTAMP, 'ACTIVE',
        'Demonstration methodology. Not a published Qhakaza method.',
        'Demo data', CURRENT_TIMESTAMP)
ON CONFLICT ("versionNumber") DO NOTHING;

INSERT INTO "IntelligenceCase" ("id", "reference", "title", "scope", "status", "openedAt", "updated_date")
VALUES ('demo-case-1', 'QAC-DEMO-001',
        'Provenance review: untitled mixed-media work',
        'Covers authorship and chain of ownership from 1984. Does NOT cover valuation.',
        'UNDER_ANALYSIS', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("reference") DO NOTHING;

INSERT INTO "Source" ("id", "name", "kind", "description", "updated_date") VALUES
  ('demo-source-1', 'Gallery consignment archive', 'Archive', 'Demonstration source.', CURRENT_TIMESTAMP),
  ('demo-source-2', 'Family correspondence', 'Private papers', 'Demonstration source.', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Evidence" ("id", "description", "status", "sourceDate", "receivedAt", "evidenceTypeId", "reliabilityId", "updated_date") VALUES
  ('demo-ev-1', 'Consignment ledger entry dated March 1984, naming the work and a consignee by initials.',
   'ACCEPTED', '1984-03-01', CURRENT_TIMESTAMP, 'evt_provenance', 'rel_primary', CURRENT_TIMESTAMP),
  ('demo-ev-2', 'Letter of 1991 referring to the work hanging in a private residence.',
   'ACCEPTED', '1991-06-01', CURRENT_TIMESTAMP, 'evt_correspond', 'rel_testimonial', CURRENT_TIMESTAMP),
  ('demo-ev-3', 'Undated photograph showing a similar work with a different signature placement.',
   'UNDER_REVIEW', NULL, CURRENT_TIMESTAMP, 'evt_photograph', 'rel_unverified', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "EvidenceSource" ("id", "evidenceId", "sourceId", "updated_date") VALUES
  ('demo-es-1', 'demo-ev-1', 'demo-source-1', CURRENT_TIMESTAMP),
  ('demo-es-2', 'demo-ev-2', 'demo-source-2', CURRENT_TIMESTAMP)
ON CONFLICT ("evidenceId", "sourceId") DO NOTHING;

INSERT INTO "Claim" ("id", "statement", "status", "material", "updated_date") VALUES
  ('demo-claim-1', 'The work was consigned by the artist in March 1984.', 'SUPPORTED', true, CURRENT_TIMESTAMP),
  ('demo-claim-2', 'The work remained in private hands from 1984 to 2019.', 'CONTESTED', true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- One item of evidence supporting TWO claims, and one item telling AGAINST a
-- claim: the shapes a one-to-one, support-only model could not hold.
INSERT INTO "EvidenceClaim" ("id", "evidenceId", "claimId", "supports", "updated_date") VALUES
  ('demo-ec-1', 'demo-ev-1', 'demo-claim-1', true,  CURRENT_TIMESTAMP),
  ('demo-ec-2', 'demo-ev-1', 'demo-claim-2', true,  CURRENT_TIMESTAMP),
  ('demo-ec-3', 'demo-ev-2', 'demo-claim-2', true,  CURRENT_TIMESTAMP),
  ('demo-ec-4', 'demo-ev-3', 'demo-claim-2', false, CURRENT_TIMESTAMP)
ON CONFLICT ("evidenceId", "claimId") DO NOTHING;

INSERT INTO "Assessment" ("id", "conclusion", "inference", "uncertainty", "methodologyVersionId", "updated_date")
VALUES ('demo-assess-1',
        'Consignment in 1984 is established. Continuous private ownership is not.',
        'The ledger is contemporaneous and internally consistent, so it is treated as primary. The 1991 letter is testimonial and corroborates only one point in the period.',
        'The consignee is named by initials alone. Nothing covers 1992 to 2018.',
        'demo-method-1', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ClaimAssessment" ("id", "claimId", "assessmentId", "updated_date") VALUES
  ('demo-ca-1', 'demo-claim-1', 'demo-assess-1', CURRENT_TIMESTAMP),
  ('demo-ca-2', 'demo-claim-2', 'demo-assess-1', CURRENT_TIMESTAMP)
ON CONFLICT ("claimId", "assessmentId") DO NOTHING;

-- Left UNRESOLVED on purpose. A demonstration in which everything is tidy shows
-- none of what the system is actually for.
INSERT INTO "Contradiction" ("id", "caseId", "firstEvidenceId", "secondEvidenceId", "description", "materiality", "updated_date")
VALUES ('demo-contra-1', 'demo-case-1', 'demo-ev-2', 'demo-ev-3',
        'The 1991 letter places the work in a private residence; the photograph suggests a variant with different signature placement.',
        'Material to authorship.', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "Evidence" SET "contradicted" = true WHERE "id" IN ('demo-ev-2', 'demo-ev-3');

INSERT INTO "Gap" ("id", "caseId", "claimId", "gapTypeId", "description", "materiality", "actionRequired", "status", "updated_date")
VALUES ('demo-gap-1', 'demo-case-1', 'demo-claim-2', 'gap_missing',
        'No documentation covering 1992 to 2018.',
        'Material: the ownership chain cannot be asserted as continuous.',
        'Request insurance schedules or exhibition loan records for the period.',
        'OPEN', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "SpecialistEscalation" ("id", "caseId", "categoryId", "specialistName", "issue", "reason", "status", "updated_date")
VALUES ('demo-esc-1', 'demo-case-1', 'spc_authentic', 'Demo Specialist',
        'Signature placement differs from the comparison photograph.',
        'Outside in-house competence; affects a material claim.',
        'IN_PROGRESS', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "CaseEvidence" ("id", "caseId", "evidenceId", "updated_date") VALUES
  ('demo-cev-1', 'demo-case-1', 'demo-ev-1', CURRENT_TIMESTAMP),
  ('demo-cev-2', 'demo-case-1', 'demo-ev-2', CURRENT_TIMESTAMP),
  ('demo-cev-3', 'demo-case-1', 'demo-ev-3', CURRENT_TIMESTAMP)
ON CONFLICT ("caseId", "evidenceId") DO NOTHING;

-- An issued version with a named accountable party, and the uncertainties
-- stated rather than smoothed over.
INSERT INTO "CaseVersion" ("id", "caseId", "versionNumber", "summary", "decisionAssessment", "uncertainties", "limitations", "methodologyVersionId", "accountableName", "accountableRole", "accountableAt", "signatureMethod", "preparedByName", "reviewedByName", "issuedAt", "updated_date")
VALUES ('demo-cver-1', 'demo-case-1', 1,
        'Authorship is well supported. The ownership chain has a material gap.',
        'Proceed only if the 1992 to 2018 period can be evidenced, or if the buyer accepts the gap explicitly.',
        'Consignee identified by initials. Signature placement query outstanding with a specialist.',
        'No valuation was undertaken and none should be inferred.',
        'demo-method-1',
        'Demo Accountable Party', 'Head of Research', CURRENT_TIMESTAMP, 'Typed name',
        'Demo Analyst', 'Demo Reviewer',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("caseId", "versionNumber") DO NOTHING;
