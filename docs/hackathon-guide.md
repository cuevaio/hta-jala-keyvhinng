# Hack the Andes 2026 – Team guide

Source: <https://hacktheandes.com/guide> (fetched 2026-10-17). This is a condensed copy
(the fetch tool summarizes pages), so re-check the original for exact wording and any updates.

**Event:** in person in Lima, October 17–18, 2026. Event Wi-Fi: `/wifi` on the site.

## 1. Team
- Confirm attendance with `andes confirm`; check your team with `andes team`.
- All members have equal permissions to post updates and edit the submission.
- The project uses the team name; change it with `andes team rename`.

## 2. Check-in and credits
- Show your `andes checkin` QR to an organizer. Generating the QR alone does not register arrival;
  an organizer must verify identity. `CHECKIN_REQUIRED` means an organizer still has to confirm you.
- After check-in, `andes credits` lists sponsor benefits, codes and redemption steps (not automatic).
- **Never publish access codes** in updates or the project description.

## 3. Tracks (pick one, via `andes team track`)
| Track | Key | Scope |
| --- | --- | --- |
| Clima y Territorio | `environmental` | water, frost, landslides, rain, agriculture, pest alerts |
| **Movilidad y Transporte** | `transport` | Lima public transport; passenger, connectivity and freight transport in regions |
| Educación Escolar | `education` | teaching tools, learning, dropout prevention, school services |
| Seguridad | `security` | extortion, scams, business/transport security, impersonation, disinformation |

Max 12 teams per track, 36 overall. Selection opens when the organization enables it.
Jala fits **Movilidad y Transporte**.

## 4. Focus and progress updates
- Before expanding scope, clarify: who has the problem, the key action they must complete,
  evidence of value, current blockers, and what you can leave out.
- Post updates after key decisions, user tests, working demos or blockers
  (`andes project update`, `andes project updates`). Updates are stored for review; no immediate replies.

## 5. Submission (`andes project submit`)
Required:
- Working **deployment URL**
- **Presentation URL** (Canva, Google Slides, or code-based)
- **GitHub repository URL**
- **Project description** in Markdown: problem, audience, how it works, limitations

Tips: test in a private window, logged out, with no local files. Organizers open links from their own
computer, so a localhost/laptop-only demo will not work. Submit early and refine later; any member can
edit, and omitted fields keep their saved values.

## 6. Pitch and judging
- **Pitch:** 3 min + 2 min Q&A, on the organization's computer using your submitted links.
- The jury receives a **snapshot** of submissions, links and updates when evaluation opens; later edits
  are not reflected.
- **Rubric** (1–5 per criterion):
  - Traction – 30%: external evidence, from interviews to strong real-world usage.
  - Technical effort – 40%: from a template with minimal changes to solid engineering (AI use is not penalized per se).
  - Pitch – 30%: from unclear to convincing and precise.
- Per-juror score (/100) = traction × 6 + technical effort × 8 + pitch × 6. Team score is the average of
  submitted evaluations from active jurors; pending evaluations do not count as zero.

## 7. Public visibility
- The gallery shows descriptions, links and updates with author names and dates once enabled.
  Treat everything as public: no keys, tokens, personal user data, or material you cannot share.
- If the last member leaves, the team dissolves and its submission/updates go to a private archive.

## 8. CLI cheat sheet (`andes`)
- Account: `login`, `whoami`, `status`, `badge`, `logout`, `update`
- Check-in: `checkin`, `checkin --no-wait`, `checkin --status`, `credits`
- Teams: `team`, `team create|rename|invite|invites|accept|decline|leave|remove|list|tracks|track`
- Projects: `project`, `project update`, `project updates`, `project submit`
- Agents/scripts: add `--output json` and explicit IDs; `--yes` confirms membership/track changes.

## 9. Related pages
`/guide`, `/participation-terms`, `/terms`, `/privacy`, `/projects`, `/credits`, `/discord` on hacktheandes.com.

## What this means for Jala
- **Technical effort (40%)** is the largest weight: the matching, routing and fare-allocation work matters most.
- **Traction (30%)** needs external evidence: plan quick interviews with concert-goers/drivers and log them
  with `andes project update`.
- **Submission needs a public deployment**, not localhost, plus a Markdown description covering problem,
  audience, how it works and limitations (the README/docs can feed this).
- Seed data is fictional; say so in the public description.
