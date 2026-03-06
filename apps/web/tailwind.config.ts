import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'brand-magenta': '#EDD5ED',
        'brand-green': '#1DB954',
        'brand-cyan': '#7FDBFF',
        'surface-card': 'rgba(204,0,204,0.10)',
        'surface-cardBorder': 'rgba(204,0,204,0.40)',
        'surface-dark': '#0D0D0D',
        'surface-darkCard': '#1A001A',
        'text-alert': '#FF4444',
        'text-alertBg': 'rgba(255,0,0,0.20)',
        'state-available': '#1DB954',
        'state-unavailable': '#FF4444',
        'state-removed': '#888888',
      },
      fontFamily: {
        orbitron: ['var(--font-orbitron)', 'sans-serif'],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
}

export default config
