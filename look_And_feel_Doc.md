# BidForge AI - Look and Feel Documentation

## Overview

BidForge AI features a premium, enterprise-grade design system inspired by the "Somerstone" aesthetic. The application combines professional construction industry styling with modern UI patterns, creating a sophisticated yet approachable interface for construction bid management.

## Color Palette

### Primary Colors

| Color Name | Purpose | Light Mode | Dark Mode |
|------------|---------|------------|-----------|
| **Deep Teal** | Primary actions, links, highlights | HSL(181, 80%, 25%) | HSL(181, 60%, 40%) |
| **Antique Gold** | Secondary actions, accents | HSL(42, 40%, 55%) | HSL(42, 40%, 55%) |
| **Charcoal** | Text, sidebar, dark elements | #1a1a1a - #666666 | Inverted for dark mode |

### Extended Color Scales

#### Charcoal Scale
- `charcoal-900`: #1a1a1a (Darkest)
- `charcoal-800`: #2c2c2c
- `charcoal-700`: #3d3d3d
- `charcoal-600`: #4f4f4f
- `charcoal-500`: #666666 (Lightest)

#### Teal Scale
- `teal-900`: #0a4d4f (Darkest)
- `teal-800`: #0c6265
- `teal-700`: #0d7377
- `teal-600`: #108387
- `teal-500`: #14a39e
- `teal-400`: #3db8b3
- `teal-300`: #66ccc8
- `teal-200`: #99e0dd
- `teal-100`: #e6f5f5 (Lightest)

#### Gold Scale
- `gold-900`: #6b5322 (Darkest)
- `gold-800`: #8a6f2f
- `gold-700`: #9d7d38
- `gold-600`: #b8995a
- `gold-500`: #c8a962
- `gold-400`: #d4bd8a
- `gold-300`: #e0d1a8
- `gold-200`: #ece5c7
- `gold-100`: #f8f4ed (Lightest)

### Background Colors

- **Main Background**: HSL(220, 20%, 88%) - A soft blue-gray that provides visual depth
- **Card Background**: Pure white (#ffffff) for content areas
- **Sidebar**: Charcoal (#1a1a1a) for strong contrast

### Border Styling

- Border color: HSL(0, 0%, 70%) - Visible gray borders
- Standard border width: `border-2` for cards and form elements
- Border radius: `rounded-xl` (0.75rem) for cards, `rounded-md` for buttons

## Typography

### Font Families

| Font | Usage | Source |
|------|-------|--------|
| **Syne** | Headings (h1-h6), display text | Google Fonts |
| **Inter** | Body text, paragraphs, UI elements | Google Fonts |
| **Fraunces** | Accent text, quotes, special emphasis | Google Fonts |
| **JetBrains Mono** | Code blocks, technical data | Google Fonts |

### Font Hierarchy

- **H1**: Syne, large display, tight tracking
- **H2-H6**: Syne, display weight, tight tracking
- **Body**: Inter, regular weight, antialiased
- **Accent Text**: Fraunces, serif style for elegant touches
- **Code/Technical**: JetBrains Mono, monospace

## Component Styling

### Cards

Cards are the primary container for content throughout the application:

```css
- Border: border-2 border-border (visible gray border)
- Background: bg-card (white in light mode)
- Border Radius: rounded-xl
- Shadow: shadow (subtle elevation)
```

### Buttons

Buttons use class-variance-authority for consistent variants:

| Variant | Appearance |
|---------|------------|
| **Default** | Teal background, white text, teal border |
| **Secondary** | Gold background, dark text |
| **Outline** | Transparent with border, inherits text color |
| **Destructive** | Red background for dangerous actions |
| **Ghost** | Transparent, no border |

Button sizes: `default`, `sm`, `lg`, `icon`

### Form Inputs

All form elements have enhanced visibility:

```css
- Border: border-2
- Background: bg-card
- Border Radius: rounded-md
- Focus Ring: ring-primary (teal)
```

### Badges

Used for status indicators and labels:
- Model badges with color coding (orange for Claude, blue for Gemini, purple for DeepSeek, green for OpenAI)
- Status badges (Latest, Pending, Completed)
- Compact sizing with `text-[10px]` for dense information display

## Layout Patterns

### Sidebar Navigation

- Fixed dark sidebar (charcoal background)
- Gold accent for active states
- Icon + text navigation items
- Collapsible on mobile

### Dashboard Grid

- Responsive grid layout
- Cards with consistent spacing
- Data visualization with Recharts

### Project Workspace

- Split-panel layout with resizable sections
- Left panel: Document upload and management
- Center panel: Rich text editor (TipTap)
- Right panel: AI generation controls and bid history

### 4-Step Workflow

Sequential workflow with visual stepper:
1. **Documents** - Upload and verify
2. **RFP Analysis** - AI-powered analysis
3. **Conflicts** - Review detected issues
4. **Bid Generation** - Generate and refine proposals

## Animations

### Defined Keyframes

| Animation | Description | Duration |
|-----------|-------------|----------|
| `fadeIn` | Opacity 0 to 1 | 0.8s ease-out |
| `slideUp` | Translate Y with fade | 1s ease-out |
| `float` | Gentle vertical movement | 6s infinite |
| `pulseSubtle` | Subtle opacity pulse | 3s infinite |

### Interactive Effects

- `hover-elevate`: Subtle lift on hover
- `active-elevate-2`: Press-down effect on click
- Smooth transitions on all interactive elements

## Data Visualization

### Charts (Recharts)

- Consistent color scheme using chart variables
- Grid lines for readability
- Visible axes with proper labeling
- Responsive sizing

### Progress Indicators

- Linear progress bars with teal fill
- Circular spinners for loading states
- Step indicators for multi-step processes

## Responsive Design

### Breakpoints

Following Tailwind CSS defaults:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Mobile Considerations

- Collapsible sidebar
- Stacked layouts on small screens
- Touch-friendly button sizes
- Simplified navigation

## Dark Mode

Full dark mode support with inverted colors:
- Background: HSL(0, 0%, 8%)
- Card: HSL(0, 0%, 12%)
- Adjusted primary and accent colors for visibility
- Maintained contrast ratios for accessibility

## Accessibility

- High contrast text
- Focus rings on interactive elements
- Proper heading hierarchy
- ARIA labels where appropriate
- Keyboard navigation support

## Design Principles

1. **Professional & Trustworthy**: Enterprise-grade appearance suitable for construction industry
2. **Clear Hierarchy**: Obvious visual distinction between elements
3. **Actionable**: Clear calls-to-action and intuitive interactions
4. **Informative**: Dense information display without clutter
5. **Responsive**: Seamless experience across devices
