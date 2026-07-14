---
name: TheVincis Design System
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4d4635'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#7f7663'
  outline-variant: '#d0c5af'
  surface-tint: '#745b00'
  primary: '#745b00'
  on-primary: '#ffffff'
  primary-container: '#c5a028'
  on-primary-container: '#493800'
  inverse-primary: '#eac249'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e2dfde'
  on-secondary-container: '#636262'
  tertiary: '#735c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#c4a028'
  on-tertiary-container: '#483800'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffe08b'
  primary-fixed-dim: '#eac249'
  on-primary-fixed: '#241a00'
  on-primary-fixed-variant: '#584400'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474746'
  tertiary-fixed: '#ffe088'
  tertiary-fixed-dim: '#e9c349'
  on-tertiary-fixed: '#241a00'
  on-tertiary-fixed-variant: '#574500'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Fraunces
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Fraunces
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Fraunces
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Fraunces
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.4'
    letterSpacing: 0.02em
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 80px
  margin-mobile: 24px
  stack-sm: 16px
  stack-md: 32px
  stack-lg: 80px
---

## Brand & Style

The brand personality is rooted in the concept of "Modern Mastery"—combining the timeless authority of a Renaissance atelier with the precision of a high-tech laboratory. This design system targets high-net-worth clients and enterprise-level partners who value meticulous craft, transparency, and architectural clarity.

The visual style is **Premium Minimalism**. It leverages expansive whitespace to create a sense of "intellectual luxury," where every pixel serves a specific purpose. We avoid unnecessary decoration, instead using fine metallic accents and high-contrast typography to guide the user's focus. The emotional response should be one of immediate trust, quiet confidence, and sophisticated innovation.

## Colors

The palette is anchored by "Vinci Gold," a custom metallic hue used with extreme restraint to denote significance and high-value interactions.

- **Primary & Tertiary:** Two shades of gold are used. `#C5A028` is the workhorse for interactive elements, while `#D4AF37` is reserved for subtle gradients and fine-line detailing.
- **Surface Strategy:** The system primarily uses "Absolute White" (`#FFFFFF`) for main containers to maximize light. "Aether Gray" (`#F9F9F9`) is used for secondary sections and background depth to prevent visual fatigue.
- **Typography:** We use a deep "Charcoal Ink" (`#1A1A1A`) instead of pure black to maintain a softer, more sophisticated editorial feel while keeping contrast ratios at AAA levels.

## Typography

This design system employs a "Dual-Era" typographic strategy, deliberately balanced to appeal across feminine and masculine sensibilities.

**Fraunces** provides the editorial authority — its soft, warm curves feel approachable while its heavy weights carry real presence. It should be used for large, impactful statements, section headers and italic hook lines. **Manrope** provides the functional, neutral-modern foundation for body copy and navigation.

- **Headlines:** Use tight tracking on serif displays to create a cohesive visual block.
- **Body:** Use generous line heights (1.6x) to facilitate effortless reading across long-form case studies.
- **Labels:** Small labels should always be uppercase with increased letter spacing to evoke a premium, "architectural" feel on metadata and tags.

## Layout & Spacing

The layout philosophy follows a **Fixed-Fluid Hybrid Grid**. Content is contained within a 1440px max-width container, centered on the screen, to maintain a premium "gallery" feel on ultra-wide monitors.

- **Vertical Rhythm:** We use an 8px base unit. Section spacing should be aggressive (`stack-lg`) to allow high-quality photography and bold headlines to breathe.
- **Grid:** A 12-column grid is standard for desktop. For case studies, use an offset grid (e.g., content spanning columns 3 through 10) to create more whitespace in the margins.
- **Mobile:** Transition to a 4-column grid with reduced vertical margins, but maintain the 24px gutter to keep the UI feeling spacious rather than cramped.

## Elevation & Depth

We utilize **Tonal Layering and Soft Diffusion** rather than traditional heavy shadows.

- **The "Vinci Lift":** Interactive cards use an extremely subtle, wide-spread shadow (0px 20px 40px rgba(0,0,0,0.04)) that makes the element appear to float slightly above the surface.
- **Fine Lines:** Use 0.5pt strokes in `#D4AF37` or a light gray (`#E5E5E5`) to define boundaries without adding visual weight.
- **Gradients:** Use linear gold gradients (from `#D4AF37` to `#C5A028`) only on primary buttons or small accent details (like a 2px top-border on a featured card) to imply a metallic sheen.

## Shapes

The shape language is "Modern-Organic." We use a **medium-radius** approach to soften the high-contrast color palette and make the interface feel more approachable.

- **Primary Radius:** 0.5rem (8px) for standard buttons and input fields.
- **Container Radius:** 1rem (16px) for cards and modals.
- **Image Treatments:** All professional photography should follow the container radius or, for specific "Signature" sections, use a slight asymmetrical roundness to create a custom, high-end feel.

## Components

- **Buttons:** Primary buttons are solid "Vinci Gold" with white uppercase text. Secondary buttons are "Ghost" style—thin 1px gold borders with gold text. Hover states should involve a subtle scale-up (1.02x) and a shift to a slightly deeper gold.
- **Chips & Tags:** Small, pill-shaped with a light gray background (`#F9F9F9`) and charcoal text. Used for categorizing services or tech stacks.
- **Inputs:** Minimalist bottom-border only or very light gray backgrounds. Focus states use a 2px Gold bottom-border.
- **Cards:** White backgrounds on light gray pages. Use the "Vinci Lift" shadow. Ensure a minimum of 40px internal padding to maintain the minimalist aesthetic.
- **Signature Component - "The Portfolio Blade":** A full-bleed horizontal section with a high-resolution background image and a centered, high-contrast Playfair Display headline. This is the primary vehicle for impact.