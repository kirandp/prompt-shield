# PromptShield Theme System

## Overview

PromptShield now includes a dual-theme system supporting both the **Legacy** (light) theme and the new **Neo-Cyber** (dark, cybersecurity-focused) theme.

## Themes

### Legacy Theme (Default)
- **Background**: Light (#ffffff)
- **Primary Accent**: Blue (#4285f4)
- **Text**: Dark (#1a1a1a)
- **Style**: Clean, enterprise-standard UI

### Neo-Cyber Theme
- **Background**: Deep Navy (#0f172a) with gradient
- **Primary Accent**: Neon Teal (#2dd4bf)
- **Text**: Light Slate (#f8fafc)
- **Style**: Glassmorphism with translucent cards, high-contrast typography
- **Features**:
  - Backdrop blur effects (12px)
  - Translucent borders (1px, rgba-based)
  - Glowing shadows with teal accent
  - Enhanced status indicators
  - Real-time sanitization flow visualization

## CSS Variables

All theme colors are defined as CSS custom properties:

```css
/* Theme colors */
--color-primary: Teal (#2dd4bf) for Neo-Cyber
--color-success: Green (#10b981)
--color-danger: Red (#ef4444)
--color-background: Semi-transparent navy for Neo-Cyber
--color-surface: Darker navy for Neo-Cyber
--color-border: Translucent white (5% opacity)
--color-text-primary: Light slate
--color-text-secondary: Medium slate
--color-text-tertiary: Dim slate
```

## Usage

### Theme Switcher Button
Located in the sidebar footer. Click to toggle between themes. Selection persists in localStorage.

### Programmatic Theme Control

```tsx
import { useTheme } from './providers/ThemeProvider';

export function MyComponent() {
  const { theme, setTheme, toggleTheme } = useTheme();
  
  return (
    <button onClick={() => setTheme('neo')}>
      Switch to Neo-Cyber
    </button>
  );
}
```

## Components

### SanitizationFlow
Visualizes the data redaction pipeline:
- Raw Input → Detection → Sanitized → Safe Output
- Color-coded stages (red → yellow → green)
- Available in: Dashboard Analytics page

### ComplianceLedger
Displays real-time compliance status:
- HIPAA, GDPR, PCI-DSS status indicators
- Compliance score progress bars
- Last updated timestamps
- Status badges (Active/Warning/Inactive)

## File Structure

```
src/app/
├── globals.css              # Theme CSS variables + Neo-Cyber styles
├── layout.tsx              # ThemeProvider setup
├── providers/
│   ├── ThemeProvider.tsx   # Theme context & logic
│   └── ThemeSwitcher.tsx   # Toggle button component
└── components/
    ├── SanitizationFlow.tsx
    └── ComplianceLedger.tsx
```

## Neo-Cyber Aesthetics

The Neo-Cyber theme implements:
- **Glassmorphism**: Semi-transparent cards with backdrop blur
- **Glow Effects**: Neon teal shadows on interactive elements
- **High Contrast**: Ensures accessibility while maintaining aesthetic
- **Motion**: Smooth transitions between theme states
- **Status Indicators**: Color-coded compliance and protection statuses

## Implementation Notes

- Theme persists across sessions via localStorage
- No flash of unstyled content (FOUC) prevention via hydration safety
- All components inherit theme via CSS custom properties
- Compatible with existing Tailwind CSS utilities
- Accessibility maintained across both themes

## Feature Checklist

✅ Shadow AI Monitoring - Works in both themes
✅ Active Protection Modes - Shadow/Fix/Warn clearly visible
✅ PII/PHI Redaction - Real-time masking visualization
✅ File Security - Scan results styled for Neo-Cyber
✅ Compliance Ledger - Multi-regulation status panel
✅ Integration Status - Live Slack/SIEM sync indicators
