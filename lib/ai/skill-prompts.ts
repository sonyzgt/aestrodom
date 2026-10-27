import type { SkillId } from "@/lib/skills";

/**
 * Extra system guidance for each skill. Static text only, so the combined system prompt stays
 * byte-stable for a given set of skills and keeps hitting the prompt cache.
 */
const SKILL_PROMPTS: Record<SkillId, string> = {
  gsap: `## Skill: GSAP animation (enabled by the user)
Use GSAP as the animation engine for this app. The packages \`gsap\` (v3.15, every plugin included and free) and \`@gsap/react\` are installed.
- In React, animate inside the \`useGSAP\` hook from \`@gsap/react\`, scoped to a container ref: \`useGSAP(() => { ... }, { scope: ref })\`. It cleans up tweens and ScrollTriggers on unmount; never animate in plain useEffect without cleanup.
- Register plugins once at module level: \`gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText)\`, importing plugins from \`gsap/ScrollTrigger\`, \`gsap/SplitText\` and so on.
- Build sequences with \`gsap.timeline()\` and position parameters instead of chained delays. Use ScrollTrigger for scroll reveals, pinned sections and scrub effects; use SplitText for headline reveals (call \`revert()\` on cleanup, which useGSAP handles when created inside it).
- Animate transform and opacity (x, y, scale, rotation, autoAlpha) rather than layout properties, and use \`gsap.utils.toArray\` with stagger for groups.
- Respect reduced motion with \`gsap.matchMedia()\`: full motion under \`(prefers-reduced-motion: no-preference)\`, and a static or simple fade otherwise. Content must be readable even if animation never runs.
- Do not animate the same element with both GSAP and framer-motion. Prefer GSAP for anything new while this skill is on.
- Keep TypeScript strict: type refs, e.g. \`useRef<HTMLDivElement>(null)\`.`,

  "ui-ux-pro-max": `## Skill: UI UX Pro Max (enabled by the user)
Design like a senior product designer. Before writing UI, decide a design system and apply it everywhere:
- Style: choose one clear direction that fits the product and audience (for example editorial, brutalist, glassmorphism, neo-minimal, bento, retro-futurist, luxury). Avoid the generic look of purple gradients on white, centered hero with three identical cards, and default shadows.
- Color: define tokens in \`@theme\` in src/index.css (background, surface, foreground, muted, border, primary, accent, success, danger). One dominant brand color, one accent, neutrals with a real tint. Text contrast at least WCAG AA (4.5:1 body, 3:1 large text).
- Typography: pair a display face and a text face that suit the style, loaded from Google Fonts in index.html with \`display=swap\`. Use a consistent type scale (for example 12, 14, 16, 20, 24, 32, 48, 64) with tight leading on headings and comfortable leading (1.5 to 1.7) on body text, and limit line length to about 70 characters.
- Layout: a 4px or 8px spacing scale, generous whitespace, a clear grid, strong visual hierarchy with one primary action per view. Vary section layouts so the page has rhythm.
- Components: every interactive element has hover, focus-visible, active and disabled states; inputs have labels, helper and error states; show loading, empty and error states for any data view. Touch targets at least 44px.
- Responsive: design mobile first from 360px; reflow rather than shrink, and check that nothing scrolls horizontally.
- Detail: consistent radii, borders and shadows from the tokens, icons from lucide-react at a consistent size and stroke, purposeful micro-interactions (150 to 300ms, ease-out), and copy that is specific to the product.
- Accessibility: semantic landmarks, one h1, alt text, aria-labels on icon buttons, visible focus rings, and motion that respects prefers-reduced-motion.`,

  "logo-design": `## Skill: Logo design (enabled by the user)
Give the app a real brand mark. Unless the project already has a logo the user wants to keep:
- Design an original logo as hand-written SVG: a symbol plus a wordmark. Base it on a simple idea from the product (an initial, a shape, a metaphor), built from geometric primitives and clean paths, not clip art or generic icons.
- Save it as public/logo.svg (symbol and wordmark) and public/favicon.svg (symbol only, legible at 16px, on a solid or transparent square). Link the favicon in index.html.
- Also create src/components/Logo.tsx that renders the mark inline as SVG with a \`className\` prop and \`currentColor\` fills where sensible, so it adapts to light and dark backgrounds, and use it in the navbar and footer.
- Use at most two colors from the app's palette. Keep a consistent stroke width, balanced negative space, and a viewBox with no stray padding. Give the svg a \`<title>\` and role="img" with an aria-label.
- The mark must still work in a single color and at small sizes; avoid thin hairlines, tiny details and text inside the symbol.
- Make sure the wordmark text matches the app name exactly. When finishing, mention in one short sentence that a logo was created.`,

  "frontend-design": `## Skill: Frontend design (enabled by the user)
Create a distinctive, production-grade interface that looks designed by a person with a point of view, not generated.
- Before coding, commit to a bold aesthetic direction that suits the purpose and audience: for example refined minimal, editorial magazine, maximalist, brutalist, art deco, organic, playful toy-like, industrial, luxury or retro-futurist. Execute it with intent and consistency; restraint and maximalism both work when deliberate.
- Typography: pick characterful, less common display fonts from Google Fonts paired with a refined text face. Avoid defaulting to Inter, Roboto, Arial, system fonts or Space Grotesk.
- Color: a cohesive palette as CSS variables in \`@theme\`, with a dominant color and sharp accents. Avoid timid evenly-spread palettes and the cliche purple-on-white gradient.
- Composition: unexpected layouts, asymmetry, overlap, diagonal flow, grid-breaking elements, and either generous negative space or controlled density.
- Atmosphere: backgrounds with depth instead of flat fills, such as gradient meshes, noise or grain, geometric patterns, layered transparency, dramatic shadows, decorative borders.
- Motion: one well-orchestrated page load with staggered reveals beats scattered micro-animations; add hover and scroll moments that surprise.
- Every app should feel different: vary themes, fonts and layouts between projects instead of converging on one look. Match code complexity to the vision, and keep it accessible and responsive.`,

  "shadcn-ui": `## Skill: shadcn/ui (enabled by the user)
Build the UI from shadcn/ui-style components written into the project. Installed: \`radix-ui\` (all Radix primitives), \`class-variance-authority\`, \`clsx\`, \`tailwind-merge\`, \`lucide-react\` and \`tw-animate-css\`. There is no shadcn CLI here: write the component source yourself.
- Create src/lib/utils.ts with \`cn(...inputs: ClassValue[]) => twMerge(clsx(inputs))\`, and components under src/components/ui/ (button.tsx, card.tsx, input.tsx, label.tsx, dialog.tsx, dropdown-menu.tsx, tabs.tsx, badge.tsx, and so on), matching the official shadcn/ui source: variants with cva, \`data-slot\` attributes, and \`className\` merged through cn.
- Import Radix from the unified package, e.g. \`import { Dialog as DialogPrimitive, Slot } from "radix-ui"\`. Use relative imports (no \`@/\` alias in this project).
- Theme with shadcn's CSS variables in src/index.css: \`@import "tailwindcss"; @import "tw-animate-css";\`, a \`@custom-variant dark (&:is(.dark *));\`, \`:root\` and \`.dark\` values for --background, --foreground, --card, --popover, --primary, --secondary, --muted, --accent, --destructive, --border, --input, --ring and --radius (oklch colors), mapped in \`@theme inline\` to --color-* tokens so classes like bg-primary and text-muted-foreground work.
- Only write the components the app uses. Compose pages from them consistently, keep Radix's accessibility (focus management, keyboard support, aria) intact, and give the theme a custom palette and radius that suit the product rather than the stock gray.`,

  "web-design-guidelines": `## Skill: Web design guidelines (enabled by the user)
Hold the UI to these web interface guidelines, and before finishing review the files you touched against them and fix violations:
- Accessibility: semantic elements (button for actions, a for navigation), labels on every input, aria-label on icon-only buttons, alt text, a logical heading order, visible :focus-visible rings, keyboard access to everything, and \`aria-live\` for async status messages.
- Forms: correct input types and autocomplete attributes, inputmode on mobile, labels that focus their input, inline errors next to the field, never block paste, and keep submit enabled until a request starts, then show progress.
- Interaction: hover, active and focus states on every control, touch targets at least 44px, \`touch-action: manipulation\`, no hover-only functionality, destructive actions confirmed or undoable, and links that look like links.
- Motion: honor prefers-reduced-motion, animate only transform and opacity, never \`transition: all\`, and keep interactions interruptible.
- Typography and content: curly quotes and the real ellipsis character, \`tabular-nums\` for numbers that change, \`text-wrap: balance\` on headings, handle long text with truncation or wrapping, and design empty, loading and error states.
- Layout and performance: no layout shift (set image width and height, reserve space for async content), responsive from 360px with no horizontal scroll, respect safe areas, lazy-load below-the-fold images, preconnect to font hosts, and use \`font-display: swap\`.
- Theming: set \`color-scheme\` and a \`<meta name="theme-color">\` matching the background, and keep contrast at WCAG AA in both light and dark themes.`,
};

/** System blocks for the enabled skills, in catalogue order. */
export function skillPrompts(skills: readonly SkillId[]): string[] {
  return skills.map((id) => SKILL_PROMPTS[id]).filter(Boolean);
}
