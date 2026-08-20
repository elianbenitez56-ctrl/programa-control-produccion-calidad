---
name: Industrial Excellence Design System
colors:
  surface: '#fbf8fe'
  surface-dim: '#dcd9df'
  surface-bright: '#fbf8fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f2f9'
  surface-container: '#f0edf3'
  surface-container-high: '#eae7ed'
  surface-container-highest: '#e4e1e8'
  on-surface: '#1b1b20'
  on-surface-variant: '#464650'
  inverse-surface: '#303035'
  inverse-on-surface: '#f3eff6'
  outline: '#767681'
  outline-variant: '#c7c5d1'
  surface-tint: '#51599a'
  primary: '#030b4f'
  on-primary: '#ffffff'
  primary-container: '#1c2463'
  on-primary-container: '#858dd2'
  inverse-primary: '#bcc2ff'
  secondary: '#005db6'
  on-secondary: '#ffffff'
  secondary-container: '#62a1ff'
  on-secondary-container: '#00376f'
  tertiary: '#2b0f00'
  on-tertiary: '#ffffff'
  tertiary-container: '#4a1f00'
  on-tertiary-container: '#e67213'
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
  tertiary-fixed: '#ffdbc8'
  tertiary-fixed-dim: '#ffb68b'
  on-tertiary-fixed: '#321300'
  on-tertiary-fixed-variant: '#743400'
  background: '#fbf8fe'
  on-background: '#1b1b20'
  surface-variant: '#e4e1e8'
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
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  mono-metrics:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 20px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px
  sidebar-width: 280px
---

## Brand & Style

This design system is engineered for **Industrial Intelligence**. It serves as the visual backbone for the SIGPC Manufacturing Execution System, balancing high-end corporate elegance with the rigorous functional requirements of a factory floor. 

The aesthetic is a fusion of **Corporate Minimalism** and **Information-Dense Utility**. It evokes trust, precision, and innovation through generous white space, a structured deep-blue foundation, and vibrant functional accents. The interface is designed to reduce cognitive load for operators while providing executive-level clarity for management.

**Core Principles:**
- **Clarity over Decoration:** Every visual element must serve a functional purpose in production control.
- **Precision:** Alignment and spacing follow a strict geometric logic.
- **Operational Authority:** The use of the Deep Blue and Institutional Orange establishes a professional, high-stakes industrial environment.

## Colors

The color palette is architected to support prolonged focus and hierarchy in complex data environments.

- **Primary & Sidebar:** The Deep Blue (`#1C2463`) and even deeper Sidebar Blue (`#0D183D`) provide a "dark mode" anchor for the navigation, ensuring the main content area feels bright and legible.
- **Institutional Orange:** Reserved strictly for primary actions, warnings, or highlighting critical production metrics (KPIs) to ensure immediate visual recognition.
- **Corporate & Light Blue:** Used for secondary actions, informational links, and "Good" status indicators in production cycles.
- **Surface & Background:** A subtle distinction between the page background and card surfaces creates a soft layered effect that prevents eye fatigue.

## Typography

The typography uses **Inter** exclusively to leverage its exceptional legibility in digital interfaces and data-heavy tables.

- **Metrics & KPIs:** Use `Title-LG` or `Display-LG` for high-level production numbers.
- **Labels:** Small, uppercase labels (`Label-MD`) should be used for table headers and form field descriptors to maintain a clean, organized grid.
- **Content Density:** In data-intensive views (like production schedules), favor `Body-MD` for row content to maximize information density without sacrificing readability.

## Layout & Spacing

The layout follows a **Fixed-Fluid Hybrid** model. The sidebar remains fixed at 280px, while the main content area utilizes a fluid 12-column grid to accommodate varying industrial monitor resolutions.

- **Grid:** 12 columns with a 24px gutter for desktop.
- **Vertical Rhythm:** A 4px baseline grid ensures consistent vertical alignment across disparate components.
- **Sectioning:** Content is grouped into distinct "Modules" (Cards) with 24px of padding between them to maintain the "high-end corporate" feel.
- **Responsive Behavior:** On tablet, the sidebar collapses into a narrow icon-only rail (80px). On mobile, the sidebar becomes a hidden drawer and the layout reflows to a single column with 16px margins.

## Elevation & Depth

This design system uses a **Tonal Layering** approach combined with **Ambient Shadows** to create a sophisticated, modern industrial feel.

- **Level 0 (Background):** `#F5F7FA` - The canvas of the application.
- **Level 1 (Cards/Surfaces):** White or `#F8FAFC` - Used for the main content containers. These features a very soft, diffused shadow: `0px 4px 20px rgba(13, 24, 61, 0.05)`.
- **Level 2 (Dropdowns/Modals):** These require higher contrast and a more defined shadow to indicate "Floating" status: `0px 10px 32px rgba(13, 24, 61, 0.12)`.
- **Interaction:** Buttons and interactive cards should subtly lift (increase shadow spread) or shift color on hover to provide tactile feedback.

## Shapes

To achieve the "Modern/Elegant" request, the design system utilizes a generous **16px (1rem)** base border radius for primary containers.

- **Primary Cards:** 16px (`rounded-lg`).
- **Inner Elements:** Buttons and Input fields use 8px (`rounded-md`) to create a nested visual harmony where the inner radius is smaller than the outer container radius.
- **Status Chips:** Full pill-shaped (`rounded-full`) to distinguish them from interactive buttons.
- **Icon Containers:** Soft squares (8px-12px) to frame Lucide icons consistently.

## Components

### Buttons
- **Primary:** Institutional Orange background, white text. Bold, sans-serif.
- **Secondary:** Transparent with Corporate Blue border and text.
- **Ghost:** No border, Neutral Gray text; for low-priority actions.

### Input Fields
- White background with a 1px border of `#E2E8F0`. 
- Focused state: 1px Corporate Blue border with a soft blue outer glow.
- Labels are positioned above the field using `Label-MD`.

### Cards
- Always use the 16px border radius.
- Headers within cards should have a subtle bottom border (`1px solid #F1F5F9`) to separate title from content.

### Production Chips (Status Indicators)
- **Active:** Light Blue background, White text.
- **Alert:** Institutional Orange background, White text.
- **Success:** Emerald Green tint (Functional extension), Dark Green text.
- **Paused:** Neutral Gray background, Dark Gray text.

### Icons
- **Lucide Icons:** Use a stroke width of 1.75px for a refined look. Icons in the sidebar should be Corporate Blue on hover; icons in primary buttons must be white.

### Data Tables
- Header background: `#F8FAFC`.
- Row hover state: `#F1F5F9` light highlight.
- Use `Mono-Metrics` for numeric values to ensure column alignment.