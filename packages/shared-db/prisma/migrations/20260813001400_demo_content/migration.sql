
-- ---------------------------------------------------------------------------
-- DEMO CONTENT
--
-- Written by the development team so the platform can be shown before Qhakaza
-- has supplied its own words. NONE OF IT IS QHAKAZA'S POSITION.
--
-- Every row below carries isDemo = true. The public pages render a visible
-- notice while any demo row is published, and the whole lot is removed with:
--
--   DELETE FROM "FaqItem"              WHERE "isDemo" = true;
--   UPDATE "Briefing"             SET "status" = 'ARCHIVED' WHERE "isDemo" = true;
--   UPDATE "LegalDocumentVersion" SET "status" = 'ARCHIVED' WHERE "isDemo" = true;
--
-- The demo answers deliberately avoid stating anything a reader could rely on:
-- no prices beyond the one already published, no promises about timing, no
-- claims about regulatory standing, and nothing about how data is processed
-- beyond what the platform demonstrably does.
-- ---------------------------------------------------------------------------

INSERT INTO "FaqCategory" ("id", "slug", "label", "ordering", "updated_date") VALUES
  ('faqc_about',      'ABOUT',      'About Qhakaza',                    10, CURRENT_TIMESTAMP),
  ('faqc_artists',    'ARTISTS',    'Artists',                          20, CURRENT_TIMESTAMP),
  ('faqc_artwork',    'ARTWORK',    'Artwork and Evidence',             30, CURRENT_TIMESTAMP),
  ('faqc_collectors', 'COLLECTORS', 'Collectors and Institutions',      40, CURRENT_TIMESTAMP),
  ('faqc_privacy',    'PRIVACY',    'Privacy and Data',                 50, CURRENT_TIMESTAMP),
  ('faqc_vera',       'VERA',       'VERA and Collector Intelligence Cases', 60, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "FaqItem" ("id", "categoryId", "question", "answer", "ordering", "published", "isDemo", "updated_date") VALUES
  ('faq_d01', 'faqc_about', 'What is Qhakaza Art Collective?',
   'Qhakaza is a private collective built around African contemporary art. It brings together represented artists, a members-only collector environment, and a research practice that documents what is known about a work before it is offered.',
   10, true, true, CURRENT_TIMESTAMP),
  ('faq_d02', 'faqc_about', 'Is Qhakaza a gallery?',
   'No. Galleries represent artists and hold exhibitions. Qhakaza sits alongside them: it prepares the record behind a work and the relationship around it, and works with galleries rather than in place of them.',
   20, true, true, CURRENT_TIMESTAMP),
  ('faq_d03', 'faqc_artists', 'How does an artist join?',
   'By invitation, or by applying through the site. An artist creates an account, builds a profile describing their practice, and submits work. Nothing an artist submits appears publicly until Qhakaza has reviewed and released it.',
   10, true, true, CURRENT_TIMESTAMP),
  ('faq_d04', 'faqc_artists', 'Can an artist publish their own work?',
   'No, and this is deliberate. An artist submits; Qhakaza reviews. If a submission needs more information, it is returned with the specific question, and the artist can answer and resubmit. Vetting that an artist could bypass would not be vetting.',
   20, true, true, CURRENT_TIMESTAMP),
  ('faq_d05', 'faqc_artwork', 'What does Qhakaza check before releasing a work?',
   'That the record is complete and internally consistent: who made it, what it is, where it has been, and what documentation exists. Where something is missing or contested, that is recorded as a gap rather than smoothed over.',
   10, true, true, CURRENT_TIMESTAMP),
  ('faq_d06', 'faqc_artwork', 'What happens when the evidence disagrees with itself?',
   'It is recorded as a contradiction and kept. Later evidence may explain which account is better supported, but it never erases the other. What was set aside, and why, stays part of the record.',
   20, true, true, CURRENT_TIMESTAMP),
  ('faq_d07', 'faqc_collectors', 'How does someone become a member collector?',
   'Membership begins with an application. Qhakaza reviews it and, if it proceeds, sends a personal invitation link that opens the private members'' area. The link is individual and is not transferable.',
   10, true, true, CURRENT_TIMESTAMP),
  ('faq_d08', 'faqc_collectors', 'What does membership cost?',
   'Annual membership is published on the Membership page. If the fee is the obstacle but the interest is genuine, there is a separate route to ask to be considered, and it does not ask about your finances.',
   20, true, true, CURRENT_TIMESTAMP),
  ('faq_d09', 'faqc_privacy', 'Who can see a collector application?',
   'Only Qhakaza staff whose role requires it. The restriction is enforced by the database itself rather than by the screens, so an artist account cannot reach collector information even if a page were built by mistake.',
   10, true, true, CURRENT_TIMESTAMP),
  ('faq_d10', 'faqc_privacy', 'How long is information kept?',
   'This is set out in the privacy policy. Qhakaza does not delete records of decisions it has taken, because being able to show what was known and when is the point of the platform.',
   20, true, true, CURRENT_TIMESTAMP),
  ('faq_d11', 'faqc_vera', 'What is VERA?',
   'VERA is the research layer: a structured record of sources, evidence, the claims that evidence supports, what remains uncertain, and where a specialist was consulted. It is not a chatbot and it does not generate opinions.',
   10, true, true, CURRENT_TIMESTAMP),
  ('faq_d12', 'faqc_vera', 'What is a Collector Intelligence Case?',
   'A prepared assessment covering one or more works: what is claimed, what supports each claim, what is missing, what is contested, and a named person accountable for the conclusion. Issued versions are kept, so a revised Case never replaces what was said before.',
   20, true, true, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Briefing bodies. The excerpts were supplied in the original design; only the
-- article text is written here, and it is written to be plausible reading for a
-- demo rather than to assert market facts.
INSERT INTO "Briefing" ("id", "slug", "title", "subtitle", "author", "category", "excerpt", "body", "sources", "status", "publishedAt", "isDemo", "updated_date") VALUES
  ('brf_d01', 'when-art-becomes-an-asset',
   'When Art Becomes an Asset: What Collectors Know and Artists Must Learn',
   'On the distance between making work and holding it as property',
   'Qhakaza Research',
   'Market Intelligence',
   'Art has always lived between two worlds. In one world, it is expression, memory, identity, ritual, beauty, rebellion, and cultural...',
   'Art has always lived between two worlds. In one it is expression: memory, identity, ritual, rebellion. In the other it is property, with all the apparatus property brings - title, provenance, insurance, valuation, and the question of what happens to it next.

Most artists are trained thoroughly in the first world and not at all in the second. Most collectors arrive already fluent in the second and are learning the first. The gap between them is where a great deal of value is lost, and it is rarely lost dramatically. It is lost in an undocumented sale, a certificate never issued, a studio record kept in a notebook that no longer exists.

What follows from this is unglamorous and consequential. A work with a complete record is not merely easier to sell; it is easier to lend, to insure, to place in an institution, and to leave to someone. A work without one may be just as good and still be much harder to move.

For artists, the practical implication is that documentation is part of the practice rather than an administrative afterthought. For collectors, it is that the absence of a record is not proof of a problem, but it is a cost, and it should be priced as one.

DEMO TEXT. Written to fill this page for demonstration. Not Qhakaza research and not a market claim.',
   'This demonstration article cites no sources because it makes no factual claims.',
   'PUBLISHED', CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP),
  ('brf_d02', 'the-visibility-gap',
   'The Visibility Gap',
   'Why quality and attention have come apart in African contemporary art',
   'Qhakaza Research',
   'Market Intelligence',
   'For years, Africa has accounted for a small share of the global art market, despite producing some of the most urgent work of...',
   'The underrepresentation of African contemporary art is often discussed as though it were a question of taste. It is more usefully understood as a question of infrastructure.

Attention follows legibility. A work becomes legible to a distant collector through the things that travel: consistent documentation, a record of where it has been shown, independent commentary, and a price history that can be checked rather than asserted. Where those exist, interest can be acted on. Where they do not, interest tends to stall at admiration.

None of this is a comment on the work itself. It is a comment on the scaffolding around it, and scaffolding can be built.

DEMO TEXT. Written to fill this page for demonstration. Not Qhakaza research and not a market claim.',
   'This demonstration article cites no sources because it makes no factual claims.',
   'PUBLISHED', CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "BriefingRelation" ("id", "fromId", "toId", "updated_date") VALUES
  ('brl_d01', 'brf_d01', 'brf_d02', CURRENT_TIMESTAMP),
  ('brl_d02', 'brf_d02', 'brf_d01', CURRENT_TIMESTAMP)
ON CONFLICT ("fromId", "toId") DO NOTHING;

-- Legal documents.
--
-- These are PLACEHOLDERS and say so in their own first paragraph, on the page,
-- unmissably. A privacy policy that reads as finished but has not been reviewed
-- is worse than an obvious placeholder: people rely on it, and it states
-- obligations the company has not agreed to.
--
-- The text below describes only what the platform demonstrably does, and
-- promises nothing.
INSERT INTO "LegalDocumentVersion" ("id", "documentKey", "versionNumber", "effectiveFrom", "title", "body", "status", "isDemo", "updated_date") VALUES
  ('legal_d_privacy', 'PRIVACY', '0.1-demo', CURRENT_TIMESTAMP, 'Privacy Policy',
   'THIS IS A PLACEHOLDER, NOT QHAKAZA''S PRIVACY POLICY. It has not been reviewed by anyone qualified to write one, and it must be replaced before this site is used by the public. It is here so the page is not empty during a demonstration.

What the platform actually does today, described plainly:

Information you give us. If you apply as a collector, we store what you enter on the form, which includes contact details and the ranges you select describing your circumstances. If you create an artist account, we store your name, email address, and what you write about your practice.

Who can see it. Access is restricted by role and enforced by the database itself rather than only by the screens. Artist accounts cannot reach collector information. Staff see only what their role requires.

What we do not do. We do not sell information to anyone. We do not currently send marketing email, because no email service is connected.

How long we keep it. Records of decisions are retained, because being able to show what was known and when is the purpose of the platform.

Asking us. Until the real policy is published, ask us directly and we will answer.',
   'PUBLISHED', true, CURRENT_TIMESTAMP),
  ('legal_d_terms', 'TERMS', '0.1-demo', CURRENT_TIMESTAMP, 'Terms of Service',
   'THIS IS A PLACEHOLDER, NOT QHAKAZA''S TERMS OF SERVICE. It has not been reviewed by anyone qualified to write one, and it must be replaced before this site is used by the public. It is here so the page is not empty during a demonstration.

In outline, and subject entirely to the real document:

Accounts. An artist account is for the artist it belongs to. A collector invitation is personal and is not transferable.

Submissions. Work an artist submits is reviewed before it is shown to anyone. Qhakaza may return a submission with a question, decline it, or withdraw it after release.

Membership. Membership is by consideration rather than purchase. Applying does not create an entitlement.

Research. A Collector Intelligence Case records what was known at the time it was issued, by a named person. It is not a guarantee, and later evidence may change the picture.

Nothing above is a contractual term. The published document will govern.',
   'PUBLISHED', true, CURRENT_TIMESTAMP)
ON CONFLICT ("documentKey", "versionNumber") DO NOTHING;
