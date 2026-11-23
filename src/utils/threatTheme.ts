import type { DisplayScannerStatus, ThreatLevel } from '../types'

export type ThreatTheme = 'connecting' | 'normal' | 'warning' | 'rogue' | 'critical' | 'offline'

interface ThreatThemeMeta {
  label: string
  color: string
  dotClass: string
  textClass: string
  borderClass: string
  bgClass: string
  pulse: boolean
  fastPulse: boolean
}

export const THREAT_THEME: Record<ThreatTheme, ThreatThemeMeta> = {
  connecting: {
    label: 'CONNECTING TO SCANNER',
    color: '#94a3b8',
    dotClass: 'bg-slate-400',
    textClass: 'text-slate-300',
    borderClass: 'border-slate-600/40',
    bgClass: 'bg-slate-500/10',
    pulse: true,
    fastPulse: false,
  },
  normal: {
    label: 'LIVE MONITORING',
    color: '#22d3ee',
    dotClass: 'bg-cyan-400',
    textClass: 'text-cyan-300',
    borderClass: 'border-cyan-400/30',
    bgClass: 'bg-cyan-400/10',
    pulse: false,
    fastPulse: false,
  },
  warning: {
    label: 'SECURITY WARNING',
    color: '#f59e0b',
    dotClass: 'bg-amber-400',
    textClass: 'text-amber-300',
    borderClass: 'border-amber-400/40',
    bgClass: 'bg-amber-400/10',
    pulse: true,
    fastPulse: false,
  },
  rogue: {
    label: 'ROGUE AP DETECTED',
    color: '#ef4444',
    dotClass: 'bg-red-500',
    textClass: 'text-red-300',
    borderClass: 'border-red-500/40',
    bgClass: 'bg-red-500/10',
    pulse: true,
    fastPulse: false,
  },
  critical: {
    label: 'CRITICAL THREAT',
    color: '#ff1744',
    dotClass: 'bg-red-500',
    textClass: 'text-red-200',
    borderClass: 'border-red-500/60',
    bgClass: 'bg-red-500/15',
    pulse: true,
    fastPulse: true,
  },
  offline: {
    label: 'SCANNER OFFLINE',
    color: '#64748b',
    dotClass: 'bg-slate-500',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-600/40',
    bgClass: 'bg-slate-500/10',
    pulse: false,
    fastPulse: false,
  },
}

export function themeForDisplayStatus(status: DisplayScannerStatus): ThreatTheme {
  switch (status) {
    case 'CONNECTING': return 'connecting'
    case 'WAITING_FOR_DATA': return 'connecting'
    case 'WAITING_FOR_SETUP': return 'connecting'
    case 'LIVE_MONITORING': return 'normal'
    case 'SECURITY_WARNING': return 'warning'
    case 'ROGUE_AP_DETECTED': return 'rogue'
    case 'CRITICAL_THREAT': return 'critical'
    case 'OFFLINE': return 'offline'
    default: return 'offline'
  }
}

export function labelForDisplayStatus(status: DisplayScannerStatus): string {
  if (status === 'WAITING_FOR_DATA') return 'WAITING FOR SCANNER DATA'
  if (status === 'WAITING_FOR_SETUP') return 'SETUP REQUIRED'
  return THREAT_THEME[themeForDisplayStatus(status)].label
}

export function themeForThreatLevel(level: ThreatLevel): ThreatTheme {
  return level
}
