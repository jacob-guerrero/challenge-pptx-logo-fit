# Reviewer notes — PPTX logo fit challenge

## Is this the real production problem?

**Yes.** In BCS Content Library branding, agency logos come in three aspect ratios (`square`, `h_rectangle`, `v_rectangle`). A single fixed frame in the slide cannot fit all three without either:

- stretching the bitmap to the frame (bad), or
- adjusting the frame / using separate frames per ratio (good).

The Carbone-style tags in production templates encode that choice: only the slot matching `logoSize` shows `unifiedLogo`; the others get transparency.

## Does one placeholder always deform?

**Not in every theoretical case** — only when the replacement image aspect ratio ≠ the placeholder frame aspect ratio (or when fill mode is “stretch”).

- If the frame is wide and you insert a tall logo **without** resizing the frame or using contain logic, PowerPoint stretches the image → **visible deformation**.
- If the candidate implements true **contain** math on `<a:ext>` / `<a:off>` (or equivalent), one slot can work for multiple logos.
- If the placeholder frame already matches the logo aspect ratio, a naive byte swap looks fine (false negative in interviews).

The baseline template uses a **horizontal** frame (~3:1). Reference `square.png` and `v_rectangle.png` will look wrong with the naive script; `h_rectangle.png` may look acceptable — that is intentional.

## Is “three slots” the only solution?

**No — but it is the intended / production-aligned answer.**

| Approach | Valid? |
|----------|--------|
| Three `<p:pic>` placeholders (h / v / square), show one hide others | ✅ Matches production |
| One placeholder + programmatic contain (resize offset/ext) | ✅ Strong engineering answer |
| One placeholder + only ever supply matching aspect logos | ⚠️ Fragile, not acceptable for multi-agency branding |
| Change only PNG bytes, never frame | ❌ Baseline (fail) |

Accept either **three-slot template** or **contain implementation** with clear `SOLUTION.md`.

## Pass criteria

- [ ] `npm run setup && npm run replace` succeeds
- [ ] All three outputs open in PowerPoint without stretched logos
- [ ] Candidate explains tradeoffs in `SOLUTION.md`
- [ ] Code is readable and stays inside this folder

## Red flags

- Hard-codes pixel sizes that only work for the bundled reference PNGs
- Requires manual edit in PowerPoint after script runs
- Deletes OOXML parts and breaks rels / content types

## Reference solution sketch (do not share with candidates)

1. Parse slide1 `<p:pic>` with `d.unifiedLogo` marker.
2. Read natural image dimensions from PNG IHDR.
3. Given frame `cx/cy`, compute contained `ext` + centered `off` (same idea as `pptxLogoPostProcessor` contain path).
4. Or: maintain three tagged pics and route by variant key.
