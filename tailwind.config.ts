import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': 'var(--bg-primary)',
        'bg-surface': 'var(--bg-surface)',
        'bg-surface-solid': 'var(--bg-surface-solid)',
        'bg-elevated': 'var(--bg-elevated)',
        'border-subtle': 'var(--border-subtle)',
        'border-medium': 'var(--border-medium)',
        'border-glow': 'var(--border-glow)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'accent-gold': 'var(--accent-gold)',
        'accent-gold-dim': 'var(--accent-gold-dim)',
        'accent-gold-glow': 'var(--accent-gold-glow)',
        'accent-slate': 'var(--accent-slate)',
        'accent-slate-glow': 'var(--accent-slate-glow)',
        'agent-kimi': 'var(--agent-kimi)',
        'agent-kimi-glow': 'var(--agent-kimi-glow)',
        'agent-claude': 'var(--agent-claude)',
        'agent-claude-glow': 'var(--agent-claude-glow)',
        'status-success': 'var(--status-success)',
        'status-running': 'var(--status-running)',
        'status-error': 'var(--status-error)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        heading: ['var(--font-heading)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
}

export default config
