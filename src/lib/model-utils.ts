'use client';

import { Cpu, Zap, Gauge, Clock, AlertTriangle } from 'lucide-react';
import {
  OpenAI,
  Anthropic,
  Google,
  DeepSeek,
  Meta,
  XAI,
  Cerebras,
  Cloudflare,
  Codex,
  Cursor,
  DeepInfra,
  Featherless,
  Fireworks,
  Gemini,
  GeminiCLI,
  Github,
  Groq,
  HuggingFace,
  KiloCode,
  Kimi,
  Kiro,
  Mistral,
  Moonshot,
  Nvidia,
  Ollama,
  OpenCode,
  OpenRouter,
  Qwen,
  Stepfun,
  XiaomiMiMo,
  Zhipu,
  Antigravity,
} from '@lobehub/icons';

// ─── Provider Icon Mapping ─────────────────────────────────
// NOTE: Default export is Mono (hitam-putih). Gunakan .Color untuk versi berwarna.
const PROVIDER_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  OpenAI: OpenAI,
  Anthropic: Anthropic,
  Google: Google.Color,
  DeepSeek: DeepSeek.Color,
  Meta: Meta.Color,
  xAI: XAI,
  Mistral: Mistral.Color,
  Cerebras: Cerebras.Color,
  Cloudflare: Cloudflare.Color,
  Codex: Codex.Color,
  Cursor: Cursor,
  DeepInfra: DeepInfra.Color,
  Featherless: Featherless.Color,
  Fireworks: Fireworks.Color,
  Gemini: Gemini.Color,
  GeminiCLI: GeminiCLI.Color,
  Github: Github,
  Groq: Groq,
  HuggingFace: HuggingFace.Color,
  KiloCode: KiloCode,
  Kimi: Kimi.Color,
  Kiro: Kiro.Color,
  Moonshot: Moonshot,
  Nvidia: Nvidia.Color,
  Ollama: Ollama,
  OpenCode: OpenCode,
  OpenRouter: OpenRouter,
  Qwen: Qwen.Color,
  Stepfun: Stepfun.Color,
  XiaomiMiMo: XiaomiMiMo,
  Zhipu: Zhipu.Color,
  Antigravity: Antigravity.Color,
};

// ─── Provider Name Normalization ────────────────────────────
// DB stores provider names in various casings, so we normalize to
// the proper-case keys used in PROVIDER_ICON_MAP.
const PROVIDER_NAME_MAP: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  deepseek: 'DeepSeek',
  meta: 'Meta',
  xai: 'xAI',
  mistral: 'Mistral',
  cerebras: 'Cerebras',
  'cloudflare-ai': 'Cloudflare',
  codex: 'Codex',
  cursor: 'Cursor',
  deepinfra: 'DeepInfra',
  'featherless-ai': 'Featherless',
  fireworks: 'Fireworks',
  gemini: 'Gemini',
  'gemini-cli': 'GeminiCLI',
  github: 'Github',
  groq: 'Groq',
  huggingface: 'HuggingFace',
  kilocode: 'KiloCode',
  'kimi-coding': 'Kimi',
  kiro: 'Kiro',
  moonshotai: 'Moonshot',
  nvidia: 'Nvidia',
  'ollama-cloud': 'Ollama',
  opencode: 'OpenCode',
  'opencode-zen': 'OpenCode',
  openrouter: 'OpenRouter',
  qwen: 'Qwen',
  stepfun: 'Stepfun',
  xiaomi: 'XiaomiMiMo',
  'xiaomi-mimo': 'XiaomiMiMo',
  'zhipu ai': 'Zhipu',
  antigravity: 'Antigravity',
  // Uppercase variants from DB
  DEEPSEEK: 'DeepSeek',
  GOOGLE: 'Google',
  META: 'Meta',
  OPENAI: 'OpenAI',
  QWEN: 'Qwen',
  STEPFUN: 'Stepfun',
  XIAOMI: 'XiaomiMiMo',
  'ZHIPU AI': 'Zhipu',
  MOONSHOTAI: 'Moonshot',
};

export function normalizeProviderName(provider: string): string {
  return PROVIDER_NAME_MAP[provider.toLowerCase()] || provider;
}

export function getProviderIcon(provider: string): React.ComponentType<{ size?: number; className?: string }> {
  return PROVIDER_ICON_MAP[normalizeProviderName(provider)] || Cpu;
}

// ─── Provider Badge Colors ─────────────────────────────────
export const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: 'bg-primary/8 text-primary/80 dark:text-primary/70',
  Anthropic: 'bg-stone-500/8 text-stone-600/80 dark:text-stone-400/60',
  Google: 'bg-sky-600/8 text-sky-700/80 dark:text-sky-400/60',
  DeepSeek: 'bg-violet-600/8 text-violet-700/80 dark:text-violet-400/60',
  Meta: 'bg-orange-600/8 text-orange-700/80 dark:text-orange-400/60',
  xAI: 'bg-rose-600/8 text-rose-700/80 dark:text-rose-400/60',
  Mistral: 'bg-cyan-600/8 text-cyan-700/80 dark:text-cyan-400/60',
};

export function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[normalizeProviderName(provider)] || '';
}

// ─── Speed Tier Config ─────────────────────────────────────
export type SpeedTier = 'fast' | 'normal' | 'slow' | 'overloaded';

export interface SpeedConfig {
  label: string;
  icon: typeof Zap;
  color: string;
  bgColor: string;
  order: number;
}

export const SPEED_CONFIG: Record<string, SpeedConfig> = {
  fast: { label: 'Cepat', icon: Zap, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500/10', order: 1 },
  normal: { label: 'Normal', icon: Gauge, color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-500/8', order: 2 },
  slow: { label: 'Lambat', icon: Clock, color: 'text-yellow-600 dark:text-yellow-400', bgColor: 'bg-yellow-500/8', order: 3 },
  overloaded: { label: 'Overload', icon: AlertTriangle, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500/10', order: 4 },
};

// ─── Sort & Filter ─────────────────────────────────────────
export type SortOption = 'default' | 'fastest' | 'slowest' | 'cheapest_input' | 'cheapest_output' | 'most_context';

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'fastest', label: 'Tercepat' },
  { value: 'slowest', label: 'Terlambat' },
  { value: 'cheapest_input', label: 'Input Termurah' },
  { value: 'cheapest_output', label: 'Output Termurah' },
  { value: 'most_context', label: 'Konteks Terbesar' },
];

export type FilterTab = 'online' | 'free' | 'discount';

// ─── Price Helpers ─────────────────────────────────────────
export function formatPrice(price: number): string {
  if (price === 0) return '$0';
  if (price < 0.001) return `$${price.toFixed(6)}/mTok`;
  if (price < 0.01) return `$${price.toFixed(4)}/mTok`;
  if (price < 1) return `$${price.toFixed(3)}/mTok`;
  return `$${price.toFixed(2)}/mTok`;
}

export function getEffectivePrice(
  basePrice: number,
  discountPercent: number,
  discountType: string,
  isOutput: boolean
): number {
  if (discountPercent <= 0 || discountType === 'none') return basePrice;
  if (discountType === 'both') return basePrice * (1 - discountPercent / 100);
  if (discountType === 'input' && !isOutput) return basePrice * (1 - discountPercent / 100);
  if (discountType === 'output' && isOutput) return basePrice * (1 - discountPercent / 100);
  return basePrice;
}

export function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return `${tokens}`;
}
