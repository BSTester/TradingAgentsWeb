# Install Chart Library for Account Trends

## Required Package

Install Recharts - a composable charting library built on React components:

```bash
cd web/frontend
npm install recharts
```

## Why Recharts?

1. **React Native**: Built specifically for React
2. **Responsive**: Works great on mobile and desktop
3. **Customizable**: Easy to style and theme
4. **Lightweight**: Smaller bundle size than Chart.js
5. **TypeScript Support**: Full TypeScript definitions included

## Alternative (if Recharts doesn't work)

If you prefer Chart.js:

```bash
npm install chart.js react-chartjs-2
```

Then update `AccountTrendModal.tsx` to use Chart.js instead of Recharts.

## Verification

After installation, verify the package is in `package.json`:

```json
{
  "dependencies": {
    "recharts": "^2.10.0"
  }
}
```

## Usage in Code

The `AccountTrendModal.tsx` component already imports and uses Recharts:

```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
```

No additional configuration needed!
