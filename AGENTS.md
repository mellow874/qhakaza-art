<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# NAMING: two things were once both called Vera

Read this before writing user-facing copy or naming an identifier.

**The Qhakaza Artist Intelligence Platform** is the artist-facing environment:
where artists build a profile, submit work, supply documentation and deal with
Qhakaza. It lives in `apps/vera/` - the directory keeps its old name because
renaming it would break the Vercel project's root-directory setting, and a
folder name is not user-facing. Do not call it Vera anywhere a person can see.

**VERA** is the evidence and decision-intelligence layer, and nothing else:
sources, evidence, claims, assessments, gaps, contradictions, specialist
referrals, Cases, methodology versions, named accountability.

One name for two systems was a collision waiting to mislead someone. If you
find `VERA_` on something that is not evidence infrastructure, it is a leftover
- `ARTIST_PLATFORM_URL` is the current name for the artist environment's
address, with `VERA_URL` still read for deployments that have not been updated.
