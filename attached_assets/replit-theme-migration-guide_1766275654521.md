# BidForge AI Theme Migration Instructions for Replit Agent

## Overview
This document provides step-by-step instructions to migrate the existing application theme to the BidForge AI brand color scheme. Follow these instructions sequentially to ensure consistent implementation across the entire application.

---

## 1. PRIMARY TASKS

### Task 1.1: Import the New Color Palette
**Action:** Add the BidForge AI color CSS file to the project

**Steps:**
1. Create or locate the main CSS file (usually `src/index.css`, `src/App.css`, or `public/styles.css`)
2. Import the BidForge colors at the top:
   ```css
   @import url('./bidforge-colors.css');
   ```
   OR copy the entire content of `bidforge-colors.css` into your main CSS file

**Verification:** Check that CSS custom properties are accessible in browser DevTools

---

### Task 1.2: Update Root CSS Variables
**Action:** Replace existing color variables with BidForge AI colors

**File Location:** Find where CSS variables are defined (usually in `:root` selector)

**Find and Replace:**
```css
/* OLD VARIABLES → NEW VARIABLES */

/* Primary Colors */
--primary-color → var(--bf-primary-blue)
--primary → var(--bf-primary-blue)
--primary-dark → var(--bf-primary-blue-dark)
--primary-light → var(--bf-primary-blue-light)

/* Background Colors */
--background-color → var(--bf-bg-cream)
--bg-color → var(--bf-bg-cream)
--bg-light → var(--bf-bg-light)
--bg-white → var(--bf-bg-white)
--background → var(--bf-bg-cream)

/* Text Colors */
--text-color → var(--bf-text-primary)
--text-primary → var(--bf-text-primary)
--text-secondary → var(--bf-text-secondary)
--text-light → var(--bf-text-light)
--text-dark → var(--bf-text-primary)

/* Accent Colors */
--accent-color → var(--bf-accent-red)
--accent → var(--bf-accent-red)
--danger → var(--bf-accent-red)
--error → var(--bf-error)

/* Gray Scale */
--gray-100 → var(--bf-gray-100)
--gray-200 → var(--bf-gray-200)
--gray-300 → var(--bf-gray-300)
--gray-400 → var(--bf-gray-400)
--gray-500 → var(--bf-gray-500)
--gray-600 → var(--bf-gray-600)
--gray-700 → var(--bf-gray-700)
--gray-800 → var(--bf-gray-800)
--gray-900 → var(--bf-gray-900)

/* Status Colors */
--success → var(--bf-success)
--warning → var(--bf-warning)
--info → var(--bf-info)
```

---

## 2. COMPONENT-SPECIFIC UPDATES

### Task 2.1: Update Button Styles
**Action:** Modify all button components to use BidForge colors

**Files to Update:**
- `src/components/Button.jsx` (or `.tsx`)
- `src/components/Button.css`
- Any other button-related files

**Changes:**
```css
/* Primary Buttons */
.btn-primary, .button-primary, .primary-button {
  background-color: var(--bf-primary-blue);
  color: var(--bf-text-white);
  border: none;
}

.btn-primary:hover {
  background-color: var(--bf-primary-blue-dark);
}

/* Secondary Buttons */
.btn-secondary, .button-secondary {
  background-color: var(--bf-bg-cream);
  color: var(--bf-primary-blue);
  border: 2px solid var(--bf-primary-blue);
}

.btn-secondary:hover {
  background-color: var(--bf-primary-blue);
  color: var(--bf-text-white);
}

/* Danger/Delete Buttons */
.btn-danger, .button-danger {
  background-color: var(--bf-accent-red);
  color: var(--bf-text-white);
}

.btn-danger:hover {
  background-color: var(--bf-accent-red-light);
}
```

---

### Task 2.2: Update Navigation/Header
**Action:** Apply BidForge colors to navigation components

**Files to Update:**
- `src/components/Navbar.jsx` or `Header.jsx`
- `src/components/Navbar.css` or `Header.css`

**Changes:**
```css
.navbar, .header, nav {
  background-color: var(--bf-primary-blue);
  color: var(--bf-text-white);
  box-shadow: var(--bf-shadow-md);
}

.nav-link, .navbar-link {
  color: var(--bf-text-white);
}

.nav-link:hover {
  color: var(--bf-bg-cream);
  background-color: var(--bf-primary-blue-dark);
}

.nav-link.active {
  background-color: var(--bf-primary-blue-dark);
  border-bottom: 3px solid var(--bf-accent-red);
}
```

---

### Task 2.3: Update Sidebar
**Action:** Style sidebar with BidForge colors

**Files to Update:**
- `src/components/Sidebar.jsx`
- `src/components/Sidebar.css`

**Changes:**
```css
.sidebar {
  background-color: var(--bf-bg-light);
  border-right: 1px solid var(--bf-gray-300);
}

.sidebar-item {
  color: var(--bf-text-primary);
  padding: var(--bf-space-md);
}

.sidebar-item:hover {
  background-color: var(--bf-gray-100);
  color: var(--bf-primary-blue);
}

.sidebar-item.active {
  background-color: var(--bf-primary-blue);
  color: var(--bf-text-white);
  border-left: 4px solid var(--bf-accent-red);
}
```

---

### Task 2.4: Update Cards
**Action:** Style all card components

**Files to Update:**
- `src/components/Card.jsx`
- Any component files with card classes

**Changes:**
```css
.card, .card-container {
  background-color: var(--bf-bg-white);
  border: 1px solid var(--bf-gray-200);
  border-radius: var(--bf-radius-lg);
  box-shadow: var(--bf-shadow-md);
  padding: var(--bf-space-lg);
}

.card:hover {
  box-shadow: var(--bf-shadow-lg);
  border-color: var(--bf-primary-blue);
}

.card-header {
  color: var(--bf-primary-blue);
  border-bottom: 2px solid var(--bf-gray-200);
  padding-bottom: var(--bf-space-sm);
  margin-bottom: var(--bf-space-md);
}

.card-title {
  color: var(--bf-text-primary);
  font-weight: 700;
}

.card-text {
  color: var(--bf-text-secondary);
}
```

---

### Task 2.5: Update Forms and Inputs
**Action:** Style all form elements

**Files to Update:**
- Form component files
- Input component files

**Changes:**
```css
.form-control, input, textarea, select {
  background-color: var(--bf-bg-white);
  border: 2px solid var(--bf-gray-300);
  border-radius: var(--bf-radius-md);
  color: var(--bf-text-primary);
  padding: var(--bf-space-sm) var(--bf-space-md);
}

.form-control:focus, input:focus, textarea:focus, select:focus {
  border-color: var(--bf-primary-blue);
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 61, 130, 0.1);
}

.form-label, label {
  color: var(--bf-text-primary);
  font-weight: 600;
  margin-bottom: var(--bf-space-xs);
}

.form-error, .input-error {
  border-color: var(--bf-error);
  background-color: rgba(220, 53, 69, 0.05);
}

.form-success, .input-success {
  border-color: var(--bf-success);
  background-color: rgba(40, 167, 69, 0.05);
}
```

---

### Task 2.6: Update Tables
**Action:** Style data tables

**Changes:**
```css
.table, table {
  background-color: var(--bf-bg-white);
  border-collapse: collapse;
  width: 100%;
}

.table thead, table thead {
  background-color: var(--bf-primary-blue);
  color: var(--bf-text-white);
}

.table th, table th {
  padding: var(--bf-space-md);
  text-align: left;
  font-weight: 600;
}

.table td, table td {
  padding: var(--bf-space-md);
  border-bottom: 1px solid var(--bf-gray-200);
  color: var(--bf-text-primary);
}

.table tbody tr:hover, table tbody tr:hover {
  background-color: var(--bf-bg-cream);
}

.table-striped tbody tr:nth-child(even) {
  background-color: var(--bf-bg-light);
}
```

---

### Task 2.7: Update Alerts/Notifications
**Action:** Style alert components

**Changes:**
```css
.alert {
  padding: var(--bf-space-md);
  border-radius: var(--bf-radius-md);
  margin-bottom: var(--bf-space-md);
}

.alert-success {
  background-color: #d4edda;
  border-left: 4px solid var(--bf-success);
  color: #155724;
}

.alert-warning {
  background-color: #fff3cd;
  border-left: 4px solid var(--bf-warning);
  color: #856404;
}

.alert-error, .alert-danger {
  background-color: #f8d7da;
  border-left: 4px solid var(--bf-error);
  color: #721c24;
}

.alert-info {
  background-color: #d1e7ff;
  border-left: 4px solid var(--bf-info);
  color: var(--bf-primary-blue-dark);
}
```

---

### Task 2.8: Update Modals/Dialogs
**Action:** Style modal components

**Changes:**
```css
.modal-overlay {
  background-color: rgba(43, 43, 43, 0.7);
}

.modal, .dialog {
  background-color: var(--bf-bg-white);
  border-radius: var(--bf-radius-lg);
  box-shadow: var(--bf-shadow-xl);
}

.modal-header, .dialog-header {
  background-color: var(--bf-primary-blue);
  color: var(--bf-text-white);
  padding: var(--bf-space-lg);
  border-radius: var(--bf-radius-lg) var(--bf-radius-lg) 0 0;
}

.modal-body, .dialog-body {
  padding: var(--bf-space-lg);
  color: var(--bf-text-primary);
}

.modal-footer, .dialog-footer {
  padding: var(--bf-space-lg);
  border-top: 1px solid var(--bf-gray-200);
  background-color: var(--bf-bg-light);
}
```

---

### Task 2.9: Update Badges/Tags
**Action:** Style badge and tag components

**Changes:**
```css
.badge, .tag {
  padding: 4px 12px;
  border-radius: var(--bf-radius-md);
  font-size: 0.875rem;
  font-weight: 600;
}

.badge-primary, .tag-primary {
  background-color: var(--bf-primary-blue);
  color: var(--bf-text-white);
}

.badge-secondary, .tag-secondary {
  background-color: var(--bf-gray-400);
  color: var(--bf-text-white);
}

.badge-success, .tag-success {
  background-color: var(--bf-success);
  color: var(--bf-text-white);
}

.badge-warning, .tag-warning {
  background-color: var(--bf-warning);
  color: #000;
}

.badge-danger, .tag-danger {
  background-color: var(--bf-accent-red);
  color: var(--bf-text-white);
}
```

---

### Task 2.10: Update Links
**Action:** Style all anchor links

**Changes:**
```css
a {
  color: var(--bf-primary-blue);
  text-decoration: none;
  transition: color 0.3s ease;
}

a:hover {
  color: var(--bf-primary-blue-dark);
  text-decoration: underline;
}

a:visited {
  color: var(--bf-primary-blue-dark);
}

a.link-accent {
  color: var(--bf-accent-red);
}

a.link-accent:hover {
  color: var(--bf-accent-red-light);
}
```

---

## 3. LAYOUT UPDATES

### Task 3.1: Update Main Application Background
**Action:** Set the main background color

**Files to Update:**
- `src/App.css` or main layout files
- `src/index.css`

**Changes:**
```css
body {
  background-color: var(--bf-bg-cream);
  color: var(--bf-text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
}

.app, .App, #root {
  background-color: var(--bf-bg-cream);
  min-height: 100vh;
}

.container, .main-content {
  background-color: var(--bf-bg-white);
  padding: var(--bf-space-2xl);
  border-radius: var(--bf-radius-lg);
  margin: var(--bf-space-lg) auto;
  box-shadow: var(--bf-shadow-md);
}
```

---

### Task 3.2: Update Page Headers
**Action:** Style page-level headers

**Changes:**
```css
.page-header, .page-title {
  color: var(--bf-text-primary);
  font-weight: 700;
  font-size: 2.5rem;
  margin-bottom: var(--bf-space-lg);
  padding-bottom: var(--bf-space-md);
  border-bottom: 3px solid var(--bf-primary-blue);
}

.page-subtitle {
  color: var(--bf-text-secondary);
  font-size: 1.25rem;
  margin-bottom: var(--bf-space-md);
}
```

---

## 4. TAILWIND CSS SPECIFIC UPDATES (If Applicable)

### Task 4.1: Update tailwind.config.js
**Action:** If the project uses Tailwind CSS, update the config file

**File Location:** `tailwind.config.js` or `tailwind.config.ts`

**Changes:**
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        'bf-blue': {
          DEFAULT: '#003D82',
          dark: '#002855',
          light: '#0052A3',
        },
        'bf-cream': {
          DEFAULT: '#E8E4DA',
          light: '#F5F3EE',
        },
        'bf-accent': {
          DEFAULT: '#C1272D',
          light: '#E63946',
        },
        'bf-gray': {
          50: '#F9F9F9',
          100: '#E8E8E8',
          200: '#D1D1D1',
          300: '#BABABA',
          400: '#A3A3A3',
          500: '#8C8C8C',
          600: '#5A5A5A',
          700: '#3D3D3D',
          800: '#2B2B2B',
          900: '#1A1A1A',
        },
      },
      boxShadow: {
        'bf-sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'bf-md': '0 4px 6px rgba(0, 0, 0, 0.07)',
        'bf-lg': '0 10px 15px rgba(0, 0, 0, 0.1)',
        'bf-xl': '0 20px 25px rgba(0, 0, 0, 0.15)',
      },
      borderRadius: {
        'bf-sm': '4px',
        'bf-md': '8px',
        'bf-lg': '12px',
        'bf-xl': '16px',
      },
    },
  },
  plugins: [],
}
```

---

## 5. FRAMEWORK-SPECIFIC UPDATES

### Task 5.1: React/Next.js Updates
**Action:** Update component styles in React components

**Instructions:**
1. Find all inline styles using `style={{}}` prop
2. Replace color values with CSS variables:
   ```jsx
   // OLD
   <div style={{ backgroundColor: '#1976d2' }}>
   
   // NEW
   <div style={{ backgroundColor: 'var(--bf-primary-blue)' }}>
   ```

3. For styled-components or emotion, update theme objects:
   ```javascript
   const theme = {
     colors: {
       primary: 'var(--bf-primary-blue)',
       primaryDark: 'var(--bf-primary-blue-dark)',
       background: 'var(--bf-bg-cream)',
       text: 'var(--bf-text-primary)',
       accent: 'var(--bf-accent-red)',
     }
   };
   ```

---

### Task 5.2: Material-UI/MUI Updates
**Action:** Update MUI theme configuration

**File Location:** Theme configuration file (usually `src/theme.js` or `src/theme.ts`)

**Changes:**
```javascript
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#003D82',
      dark: '#002855',
      light: '#0052A3',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#E8E4DA',
      dark: '#D1CEC4',
      light: '#F5F3EE',
      contrastText: '#2B2B2B',
    },
    error: {
      main: '#C1272D',
    },
    warning: {
      main: '#FFC107',
    },
    success: {
      main: '#28A745',
    },
    info: {
      main: '#003D82',
    },
    background: {
      default: '#E8E4DA',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#2B2B2B',
      secondary: '#5A5A5A',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  shape: {
    borderRadius: 8,
  },
  shadows: [
    'none',
    '0 1px 2px rgba(0, 0, 0, 0.05)',
    '0 4px 6px rgba(0, 0, 0, 0.07)',
    '0 10px 15px rgba(0, 0, 0, 0.1)',
    '0 20px 25px rgba(0, 0, 0, 0.15)',
    // ... add remaining shadows
  ],
});

export default theme;
```

---

## 6. VERIFICATION CHECKLIST

After completing all updates, verify the following:

### Visual Inspection Checklist:
- [ ] All buttons use BidForge blue (#003D82)
- [ ] Main background is cream (#E8E4DA)
- [ ] Navigation bar is blue with white text
- [ ] Cards have white background with subtle shadows
- [ ] Forms and inputs have proper blue focus states
- [ ] Tables have blue headers
- [ ] Alerts use correct color coding
- [ ] All text is readable against backgrounds
- [ ] Hover states are consistent across components
- [ ] Links are blue and underline on hover

### Technical Verification:
- [ ] No console errors related to CSS
- [ ] All CSS variables are properly defined
- [ ] No broken styles or layout issues
- [ ] Mobile responsive design still works
- [ ] Dark mode (if applicable) still functions
- [ ] Print styles (if applicable) still work

---

## 7. TESTING PROCEDURES

### Test 7.1: Component Testing
**Action:** Test each component individually

**Steps:**
1. Navigate to each page/route in the application
2. Check all interactive elements (buttons, links, inputs)
3. Test hover states
4. Test active/selected states
5. Test disabled states
6. Take screenshots for comparison

### Test 7.2: Responsive Testing
**Action:** Test on different screen sizes

**Breakpoints to test:**
- Mobile: 375px, 414px
- Tablet: 768px, 1024px
- Desktop: 1280px, 1920px

### Test 7.3: Browser Testing
**Action:** Test in multiple browsers

**Browsers:**
- Chrome/Edge
- Firefox
- Safari
- Mobile browsers

---

## 8. ROLLBACK PLAN

**Action:** If issues occur, revert changes

**Steps:**
1. Use Git to revert to previous commit:
   ```bash
   git revert HEAD
   ```
   OR
   ```bash
   git reset --hard [previous-commit-hash]
   ```

2. Remove the BidForge CSS import

3. Restore original CSS variable definitions

---

## 9. PERFORMANCE OPTIMIZATION

### Task 9.1: CSS Cleanup
**Action:** Remove unused CSS after migration

**Steps:**
1. Use PurgeCSS or similar tools to remove unused styles
2. Combine duplicate selectors
3. Minify CSS for production

### Task 9.2: Consolidate CSS Variables
**Action:** Ensure no duplicate variable definitions

**Steps:**
1. Search for `:root` selectors across all CSS files
2. Consolidate into single source of truth
3. Remove old variable definitions

---

## 10. DOCUMENTATION UPDATES

### Task 10.1: Update Style Guide
**Action:** Document the new color system

**Create/Update:**
- Style guide with color swatches
- Component library with examples
- Design tokens documentation
- README with theme information

---

## 11. PRIORITY ORDER

Execute tasks in this order for minimal disruption:

1. **HIGH PRIORITY (Do First):**
   - Task 1.1: Import Color Palette
   - Task 1.2: Update Root Variables
   - Task 3.1: Update Main Background
   - Task 2.1: Update Buttons

2. **MEDIUM PRIORITY (Do Second):**
   - Task 2.2: Navigation
   - Task 2.3: Sidebar
   - Task 2.4: Cards
   - Task 2.5: Forms

3. **LOW PRIORITY (Do Last):**
   - Task 2.6-2.10: Other Components
   - Task 9: Performance Optimization
   - Task 10: Documentation

---

## 12. COMMON PITFALLS TO AVOID

1. **Don't:** Override CSS variables with hardcoded values
   - ❌ `color: #003D82;`
   - ✅ `color: var(--bf-primary-blue);`

2. **Don't:** Use `!important` to force colors
   - Fix specificity issues instead

3. **Don't:** Mix old and new color systems
   - Complete migration of each component

4. **Don't:** Forget to update SVG fill colors
   - Update icon colors too

5. **Don't:** Skip testing on different backgrounds
   - Test on both white and cream backgrounds

---

## 13. QUICK REFERENCE - COLOR MAPPINGS

```
COMMON COLOR REPLACEMENTS:

Blue/Primary Colors:
#1976d2, #2196F3, #0d47a1 → var(--bf-primary-blue)
#1565c0, #0c3d7c → var(--bf-primary-blue-dark)

Red/Accent Colors:
#f44336, #d32f2f, #c62828 → var(--bf-accent-red)

Background Colors:
#f5f5f5, #fafafa, #e0e0e0 → var(--bf-bg-cream)
#ffffff, white → var(--bf-bg-white)

Text Colors:
#000000, #212121, #333 → var(--bf-text-primary)
#757575, #666 → var(--bf-text-secondary)
#9e9e9e, #999 → var(--bf-text-light)

Gray Colors:
#e0e0e0 → var(--bf-gray-300)
#bdbdbd → var(--bf-gray-400)
#757575 → var(--bf-gray-600)
```

---

## 14. COMPLETION CRITERIA

The migration is complete when:

✅ All components visually match BidForge AI brand colors
✅ No hardcoded color values remain (except in bidforge-colors.css)
✅ All tests pass
✅ Documentation is updated
✅ Code review is completed
✅ Stakeholder approval received

---

## NOTES FOR REPLIT AGENT

- Work systematically through each task
- Test after each major change
- Commit changes frequently with clear messages
- If you encounter errors, document them and continue with other tasks
- Prioritize visible components (buttons, navigation) first
- Keep the original CSS files as backup
- Ask for clarification if component structure is unclear

---

**Last Updated:** December 2024
**Version:** 1.0
**Author:** BidForge AI Team
