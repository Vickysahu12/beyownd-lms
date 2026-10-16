# Interview Prep — How to use these docs

These docs are **for you to speak from**, not for the codebase. Build docs (`docs/phases/`) say *what the code does*; interview docs say *how to talk about it so the interviewer believes you can do the work*.

## The one rule

**Only claim what you built and ran.** If something is designed but not built, say "designed, not yet built". If a number wasn't measured, don't quote it. Interviewers dig — one honest "I haven't load-tested that yet, here's how I would" beats one exaggeration that falls apart on the follow-up question.

## Files

| File | Use it for |
| --- | --- |
| [00-project-pitch.md](00-project-pitch.md) | "Tell me about your project" — the 30-second and 2-minute versions |
| [01-tech-stack-decisions.md](01-tech-stack-decisions.md) | "Why did you choose X?" — every stack decision with the trade-off |
| `phase-N-*.md` | Deep-dive per phase: what you built, decisions, bugs you found, likely questions + answers |

## Format of every phase interview doc

1. **One-line summary** — what this part does
2. **How it works** — explained the way you'd draw it on a whiteboard
3. **Decisions & trade-offs** — "I chose A over B because…, the cost was…"
4. **Problems I hit and fixed** — real bugs, how you found them, what you changed (interviewers love these)
5. **Likely questions + answers**
6. **At 100× scale I would…** — shows you know the limits of your own design

## How interviewers judge "can this person do the work"

- Can you explain **why**, not just **what**?
- Do you know the **trade-offs** of your own choices?
- Did you hit **real problems** and debug them?
- Do you know **where your design breaks** and what you'd do next?
- Did you **measure** anything?

Every phase doc is written to give you an answer for each of these.
