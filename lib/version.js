// Build level — bumped once per delivered update so you can confirm at a
// glance which version is actually live on Vercel after a deploy.
export const APP_LEVEL = 33;
export const APP_LEVEL_NOTES = 'Faster transitions on Level 32. The iOS-style open/close screen animation is now much quicker and smoother — the enter is ~0.24s (was 0.42s), the pause before the new page appears dropped to 60ms (was 120ms), and the heavy motion-blur was removed (blur animations stutter; plain opacity+transform glide). Panels that pop open (submission detail, a person’s progress) also snap in faster. Everything still respects the device’s reduced-motion setting. No data or meter-maths changes.';
