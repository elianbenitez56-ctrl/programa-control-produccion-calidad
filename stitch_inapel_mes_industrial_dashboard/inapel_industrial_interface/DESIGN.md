---
name: Industrial Integrity
colors:
  surface: '#f8f9ff'
  surface-dim: '#ccdbf4'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dde9ff'
  surface-container-highest: '#d5e3fd'
  on-surface: '#0d1c2f'
  on-surface-variant: '#464650'
  inverse-surface: '#233144'
  inverse-on-surface: '#ebf1ff'
  outline: '#767681'
  outline-variant: '#c7c5d1'
  surface-tint: '#51599a'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#091254'
  on-primary-container: '#777fc3'
  inverse-primary: '#bcc2ff'
  secondary: '#015db6'
  on-secondary: '#ffffff'
  secondary-container: '#64a1fe'
  on-secondary-container: '#00376f'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#091254'
  on-tertiary-container: '#777fc3'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dfe0ff'
  primary-fixed-dim: '#bcc2ff'
  on-primary-fixed: '#091254'
  on-primary-fixed-variant: '#394181'
  secondary-fixed: '#d6e3ff'
  secondary-fixed-dim: '#a9c7ff'
  on-secondary-fixed: '#001b3d'
  on-secondary-fixed-variant: '#00468b'
  tertiary-fixed: '#dfe0ff'
  tertiary-fixed-dim: '#bcc2ff'
  on-tertiary-fixed: '#091254'
  on-tertiary-fixed-variant: '#394181'
  background: '#f8f9ff'
  on-background: '#0d1c2f'
  surface-variant: '#d5e3fd'
  success-green: '#16a34a'
  error-red: '#ba1a1a'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  sidebar_width: 260px
  header_height: 64px
---

## Brand & Style

The brand identity is built on **Industrial Reliability** and **Precision**. It is a high-utility, corporate-modern system designed for Manufacturing Execution Systems (MES) where clarity, data density, and immediate status recognition are critical. 

The visual style follows a **Structured Material** approach: it utilizes a deep navy primary palette to evoke authority and trust, contrasted with high-utility status colors (success green, error red, warning amber). The interface prioritizes information hierarchy through clear containment, subtle borders, and a systematic grid that ensures operators can make split-second decisions based on visual cues. The tone is professional, technical, and unobtrusive.

## Colors

The palette is anchored by **Deep Navy (#030b4f)**, providing a high-contrast foundation for the sidebar and primary actions. 

- **Primary & Secondary:** Used for branding and interactive states (Operator Mode, active nav items).
- **Surface System:** Employs a cool-tinted light gray/blue range (`#f8f9ff` to `#ccdbf4`) to reduce eye strain in industrial environments while maintaining a clean look.
- **Semantic Colors:** Critical for status. `Success Green` indicates active production, while `Error Red` is reserved for machine stops and quality failures.
- **Tints:** Use 10-20% opacity fills of semantic colors for background containers (e.g., alert cards) to ensure text remains legible while conveying state.

## Typography

The system uses **Inter** exclusively to leverage its high legibility in data-dense environments. 

- **Numerical Data:** `Display LG` is used for primary KPIs to make them visible from a distance (walking the shop floor).
- **Hierarchy:** Bold weights are used for headlines and navigation labels to ensure clear structure. 
- **Labels:** Uppercase styling with 0.05em letter-spacing is applied to small metadata labels (e.g., "Current OP", "Area") to distinguish them from dynamic data values.
- **Mobile Scaling:** For `display-lg`, scale down to 32px on mobile devices to prevent horizontal overflow.

## Layout & Spacing

The layout utilizes a **Fixed Sidebar / Fluid Content** model. 

- **Sidebar:** A fixed 260px vertical navigation provides consistent access to factory areas.
- **Grid:** The main canvas uses a 12-column fluid grid. Components (KPIs, Charts) should span 3, 4, 6, or 12 columns depending on screen width.
- **Margins & Gutters:** A standard 24px (`lg`) padding is applied to the main scrollable canvas. Inner component spacing follows an 8px (sm) and 16px (md) rhythm.
- **Mobile:** On mobile, the sidebar collapses into a hamburger menu. The 4-column KPI grid reflows into a single-column vertical stack.

## Elevation & Depth

Hierarchy is established through **Tonal Layering** and **Subtle Outlines** rather than heavy shadows.

- **Background:** Level 0 uses the `#f8f9ff` background color.
- **Cards/Containers:** Level 1 uses `#ffffff` (surface-lowest) with a 1px solid border in `outline-variant` (#c7c5d1). This creates a crisp, "flat-plus" look.
- **Hover States:** Interactive cards transition to a slightly darker border (`primary`) or a very soft `shadow-sm` to indicate clickability.
- **Headers:** The TopAppBar uses a bottom-border (`outline-variant`) to separate from the scrollable canvas without needing a heavy drop shadow.

## Shapes

The design uses a **Soft (Level 1)** shape language to maintain a professional, industrial feel without appearing overly "bubbly."

- **Standard Elements:** Buttons and small containers use a 0.25rem (4px) radius.
- **Cards:** Dashboard cards and machine status units use `rounded-lg` (0.5rem) for a more defined container feel.
- **Status Pills:** Badges and indicators use `rounded-full` (12px+) to create a distinct visual shape compared to the square data containers.

## Components

- **Buttons:** Primary buttons are solid (Secondary blue or Primary navy). Action buttons for secondary tasks (Filter/Export) use a ghost style with a light gray fill and 1px border.
- **Status Chips:** Use a background-tinted approach. "Producing" = Green tint + Green text; "Stopped" = Red tint + Red text. Include a small dot or icon for accessibility.
- **KPI Cards:** Must contain a label, a large display value, and a trend indicator (arrow up/down). Use a subtle decorative background shape (10% opacity) in the top right to reinforce the metric's category.
- **Machine Cards:** High-density components featuring a header with icon/title/status, a 2-column data grid for specs, and a bottom progress bar representing the current job completion.
- **Input Fields:** Should have a 1px border with a 4px radius. Use `#464650` for placeholder text to ensure contrast compliance.