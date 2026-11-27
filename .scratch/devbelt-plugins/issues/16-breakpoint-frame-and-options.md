# 16: Breakpoint: real Frame width, options and pinning

**What to build:** Inside the Frame the readout shows the Frame's actual width (including custom sizes), the Plugin accepts a base-name option and an initial-outline option, and unpinning hides the readout and the outline toggle together.

**Blocked by:** Review-fixes branch (`fix/devbelt-review-findings`) merged

**Status:** resolved

Spec: `docs/specs/breakpoint.md` (follow-up from the code review of `spec/devbelt-plugins`); ADR 0003 and the Glossary apply.

- [x] Readout uses the Frame's real width, including a custom size
- [x] Base-name and initial-outline options work
- [x] Unpinning hides readout and toggle together, and the outline stops
- [x] Tests cover each
