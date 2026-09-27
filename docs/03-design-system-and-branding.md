# 03 - Design System & Branding

This document outlines the design system, visual identity, and component library primitives for the e-commerce platform. It serves as the single source of truth for design decisions and implementation details across web (Next.js/Tailwind/Shadcn) and mobile (Expo/React Native).

## 1. Visual Identity & Brand Tone

### Brand Personality

Minimalist, premium, confident, approachable, and effortless. We provide elevated basics and timeless pieces. Our design language should reflect this: no unnecessary clutter, ample whitespace, sharp typography, and high-quality imagery. Think Everlane, COS, or Uniqlo.

### Voice & Tone

- **Confident & Direct:** Avoid jargon. Say "Add to Cart" instead of "Please add this item to your cart".
- **Helpful & Approachable:** Clear error messages ("We need your email to send the receipt" instead of "Invalid input").
- **Premium:** Refined and understated. Less is more.

### Photography Direction

- **Lifestyle:** Natural lighting, unstructured, candid feel. Subjects interacting with the environment naturally.
- **Model (Studio):** Clean neutral backgrounds (off-white or soft gray). Focus on drape, fit, and fabric texture.
- **Flat Lays:** Strict grid alignments, uniform lighting, used for accessories or detail shots.
- **Aspect Ratios:** 3:4 for product cards (taller, fashion-standard). 16:9 for hero banners. 1:1 for detail square crops.

### Logo Usage

- **Primary:** Wordmark in deep charcoal or black.
- **Secondary/Monogram:** Used for avatars, favicons, or subtle watermarks.
- **Clear Space:** Always maintain a clear space of at least half the logo's height around it.

---

## 2. Color Palette

Our palette is grounded in warm neutrals with subtle, sophisticated accents, allowing the clothing to stand out.

### Tailwind CSS Configuration (`tailwind.config.ts`)

```typescript
import type { Config } from 'tailwindcss';

const config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#171717', // Neutral 900
          foreground: '#FAFAFA', // Neutral 50
          hover: '#262626', // Neutral 800
        },
        secondary: {
          DEFAULT: '#F5F5F4', // Stone 100
          foreground: '#1C1917', // Stone 900
          hover: '#E7E5E4', // Stone 200
        },
        accent: {
          DEFAULT: '#695E4F', // Warm, muted taupe/olive
          foreground: '#FFFFFF',
          hover: '#574D41',
        },
        destructive: {
          DEFAULT: '#B91C1C', // Red 700
          foreground: '#FEF2F2',
          hover: '#991B1B',
        },
        success: {
          DEFAULT: '#15803D', // Green 700
          foreground: '#F0FDF4',
        },
        warning: {
          DEFAULT: '#A16207', // Yellow 700
          foreground: '#FEFCE8',
        },
        info: {
          DEFAULT: '#0369A1', // Sky 700
          foreground: '#F0F9FF',
        },
        muted: {
          DEFAULT: '#F5F5F5',
          foreground: '#737373',
        },
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
      },
    },
  },
} satisfies Config;

export default config;
```

### CSS Variables (`globals.css`)

```css
@layer base {
  :root {
    --background: 0 0% 100%; /* #FFFFFF */
    --foreground: 0 0% 9%; /* #171717 */
    --border: 0 0% 90%; /* #E5E5E5 */
    --input: 0 0% 90%; /* #E5E5E5 */
    --ring: 0 0% 9%; /* #171717 */
    --radius: 0.25rem; /* 4px - very slight rounding for premium feel */
  }

  .dark {
    --background: 0 0% 4%; /* #0A0A0A */
    --foreground: 0 0% 98%; /* #FAFAFA */
    --border: 0 0% 15%; /* #262626 */
    --input: 0 0% 15%; /* #262626 */
    --ring: 0 0% 83%; /* #D4D4D4 */
  }
}
```

---

## 3. Typography Scale

We use clean, legible fonts to maintain a modern, editorial look.

- **Primary (Sans-serif):** `Inter` or `Geist Sans` for UI, body copy, and navigation.
- **Display (Serif or Refined Serif):** `Playfair Display` or `Newsreader` for impactful headings and editorial sections.
- **Mono:** `JetBrains Mono` or `Geist Mono` for technical details (SKUs, order numbers).

### Tailwind CSS Configuration (`tailwind.config.ts`)

```typescript
theme: {
  extend: {
    fontFamily: {
      sans: ['var(--font-inter)', 'sans-serif'],
      display: ['var(--font-playfair)', 'serif'],
      mono: ['var(--font-mono)', 'monospace'],
    },
    fontSize: {
      // Mobile / Desktop
      'xs': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.02em' }], // 12px
      'sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0.01em' }], // 14px
      'base': ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.01em' }], // 16px
      'lg': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }], // 18px
      'xl': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.01em' }], // 20px
      '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.02em' }], // 24px
      '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.02em' }], // 30px
      '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.02em' }], // 36px / Display Small
      '5xl': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }], // 48px / Display Medium
      '6xl': ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }], // 60px / Display Large
      '7xl': ['4.5rem', { lineHeight: '1.1', letterSpacing: '-0.03em' }], // 72px / Display X-Large
    }
  }
}
```

### Font Weights

- **Regular (400):** Body copy, secondary text.
- **Medium (500):** Buttons, tabs, subheadings, emphasis in body copy.
- **Semibold (600):** Section headers, product titles.
- **Bold (700):** Reserved for display headings or extreme emphasis.

---

## 4. Spacing & Layout System

We use a strict 4px/8px base grid system.

- **Tokens:** `space-1` (4px), `space-2` (8px), `space-4` (16px), `space-6` (24px), `space-8` (32px), `space-12` (48px), `space-16` (64px), `space-24` (96px).

### Container Widths

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1440px
- `max-w-screen-2xl` is the standard constraint for main content blocks.

### Section Padding

- **Mobile:** `py-12 px-4` (48px vertical, 16px horizontal)
- **Tablet:** `py-16 px-8` (64px vertical, 32px horizontal)
- **Desktop:** `py-24 px-12` (96px vertical, 48px horizontal)

---

## 5. Component Primitives Catalog

### Buttons

- **Primary:** Black background, white text. Solid, heavy feel. `bg-primary text-primary-foreground hover:bg-primary-hover`
- **Secondary:** Light gray background, black text. `bg-secondary text-secondary-foreground hover:bg-secondary-hover`
- **Outline:** Transparent background, black border. `border border-input bg-background hover:bg-accent hover:text-accent-foreground`
- **Ghost:** No border, transparent background. `hover:bg-accent hover:text-accent-foreground`
- **Sizes:** `sm` (h-9 px-3), `md` (h-10 px-4 py-2), `lg` (h-12 px-8 py-3 text-lg)
- **States:** `disabled:opacity-50 disabled:cursor-not-allowed`, Loading states show an inline spinner (Lucide `Loader2` with `animate-spin`).

### Inputs

- **Base Style:** Minimalist, bottom border only on mobile, or very subtle full border on desktop.
- `h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50`

### Modals / Dialogs

- **Overlay:** Black with 40% opacity and backdrop blur (`bg-black/40 backdrop-blur-sm`).
- **Animation:** Fade in, slight scale up (Framer Motion `initial={{ opacity: 0, scale: 0.95 }}`).
- **Behavior:** Trap focus inside, close on escape key, close on outside click.

### Cards

- **Product Card:** Minimal border, transparent background. Focus is entirely on the image and typography.
- **Cart/Order Card:** Subtle gray border (`border-border`), padded (`p-4`), white background.

### Badges

- Small, uppercase, slight letter spacing.
- **In Stock:** Hidden by default (assumed).
- **Low Stock:** `bg-warning text-warning-foreground text-[10px] tracking-wider px-2 py-0.5 uppercase`
- **Out of Stock:** `bg-muted text-muted-foreground ...`
- **Sale:** `bg-destructive text-destructive-foreground ...`

### Toast Notifications

- Positioned bottom-right on desktop, top-center on mobile.
- Simple, slide-in animation.
- Auto-dismiss after 4000ms.

---

## 6. E-commerce UI Patterns

### Product Card

- **Image:** 3:4 Aspect ratio (`aspect-[3/4] object-cover`).
- **Hover:** Secondary image fade-in on hover (desktop).
- **Interactions:** Wishlist heart icon top-right (absolute positioned). Quick Add button slides up from bottom of image container on hover.
- **Typography:** Brand/Title (Semibold, base), Price (Regular, base).

### Product Gallery (PDP)

- **Desktop:** Main sticky image column on right, scrolling grid of large 3:4 images on left, or sticky details on right with masonry images on left.
- **Mobile:** Horizontal swipeable carousel with pagination dots. Pinch-to-zoom enabled.

### Sticky Cart Drawer

- Slides in from right (`translate-x-full` to `translate-x-0`).
- Always visible subtotal at the bottom with a sticky, full-width "Checkout" primary button.
- Clean quantity selectors (+ / -) next to item price.

### Micro-interactions

- **Add to Cart:** Cart icon in header bounces slightly; unread count badge scales up then down.
- **Wishlist:** Heart icon fills with black (`fill-current text-primary`) and scales up slightly (1.2x) on click.
- **Page Transitions:** Gentle fade (`opacity 0 -> 1`) over 200ms using Framer Motion.

---

## 7. Responsive Design Breakpoints

- **Mobile (`sm`):** 640px. 1-column product grids. Mobile nav drawer (hamburger).
- **Tablet (`md`):** 768px. 2-column or 3-column product grids.
- **Desktop (`lg`):** 1024px. 4-column product grids. Mega-menu navigation.
- **Wide (`xl`):** 1280px.
- **Ultra (`2xl`):** 1536px.

```typescript
// tailwind.config.ts
screens: {
  'sm': '640px',
  'md': '768px',
  'lg': '1024px',
  'xl': '1280px',
  '2xl': '1536px',
}
```

---

## 8. Animation & Motion

Keep animations subtle, purposeful, and quick. Avoid "floaty" or slow animations.

### Timing Tokens

- `duration-fast`: 150ms (Hover states, color changes)
- `duration-normal`: 200ms (Dropdowns, modals fading in)
- `duration-slow`: 300ms (Drawers sliding in, page transitions)

### Easing

- Primary Easing (Spring-like, natural): `cubic-bezier(0.16, 1, 0.3, 1)`

### Framer Motion Snippets

**Drawer Slide-in:**

```tsx
const drawerVariants = {
  hidden: { x: '100%', transition: { ease: [0.16, 1, 0.3, 1], duration: 0.3 } },
  visible: { x: '0%', transition: { ease: [0.16, 1, 0.3, 1], duration: 0.4 } },
};
```

**Fade-in List Items (Staggered):**

```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};
```

---

## 9. Accessibility (a11y)

- **Color Contrast:** All text on background colors must meet WCAG 2.1 AA standards (minimum 4.5:1 ratio). Primary button text (white on neutral-900) easily exceeds this.
- **Focus Rings:** Visible focus rings for keyboard navigation. We use a high-contrast ring with an offset: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none`.
- **Screen Readers:**
  - Provide `aria-label` for icon-only buttons (e.g., Wishlist heart, Cart icon, Close modal).
  - Use `aria-live="polite"` for dynamic content changes like Cart Count updates or Toast notifications.
- **Touch Targets:** Minimum 48x48px clickable area for interactive elements on mobile devices (e.g., hamburger menu, pagination buttons). Padding is applied to achieve this even if the visual element is smaller.
