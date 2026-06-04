// Topup packages
export const TOPUP_PACKAGES = [
  { kredit: 1, price: 12000 },
  { kredit: 5, price: 60000 },
  { kredit: 10, price: 120000 },
  { kredit: 25, price: 300000 },
  { kredit: 50, price: 600000 },
];

// Chart colors for models (cycle through these)
export const MODEL_INPUT_COLORS = [
  { stroke: '#5a8a7a', fillId: 'modelInGrad0' },
  { stroke: '#4a7a9a', fillId: 'modelInGrad1' },
  { stroke: '#7a6aaa', fillId: 'modelInGrad2' },
  { stroke: '#b07a5a', fillId: 'modelInGrad3' },
  { stroke: '#b06070', fillId: 'modelInGrad4' },
  { stroke: '#5a8a9a', fillId: 'modelInGrad5' },
  { stroke: '#6a6aaa', fillId: 'modelInGrad6' },
  { stroke: '#9a8a4a', fillId: 'modelInGrad7' },
];

export const MODEL_OUTPUT_COLORS = [
  { stroke: '#9a7a4a', fillId: 'modelOutGrad0' },
  { stroke: '#4a8a9a', fillId: 'modelOutGrad1' },
  { stroke: '#8a7aaa', fillId: 'modelOutGrad2' },
  { stroke: '#b08a5a', fillId: 'modelOutGrad3' },
  { stroke: '#b07a8a', fillId: 'modelOutGrad4' },
  { stroke: '#5a9aaa', fillId: 'modelOutGrad5' },
  { stroke: '#7a7aaa', fillId: 'modelOutGrad6' },
  { stroke: '#aa9a5a', fillId: 'modelOutGrad7' },
];

// Provider colors
export const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: 'bg-primary/8 text-primary/8 dark:text-primary/70',
  Anthropic: 'bg-stone-600/8 text-stone-600/80 dark:text-stone-400/60',
  Google: 'bg-sky-600/8 text-sky-700/80 dark:text-sky-400/60',
  DeepSeek: 'bg-violet-600/8 text-violet-700/80 dark:text-violet-400/60',
  Meta: 'bg-orange-600/8 text-orange-700/80 dark:text-orange-400/60',
  xAI: 'bg-rose-600/8 text-rose-700/80 dark:text-rose-400/60',
  Mistral: 'bg-cyan-600/8 text-cyan-700/80 dark:text-cyan-400/60',
};

// Chart bar colors for providers - full opacity for visibility
export const PROVIDER_BAR_COLORS: Record<string, string> = {
  OpenAI: 'bg-primary/50',
  Anthropic: 'bg-stone-500',
  Google: 'bg-sky-500',
  DeepSeek: 'bg-violet-500',
  Meta: 'bg-orange-500',
  xAI: 'bg-rose-500',
  Mistral: 'bg-cyan-500',
};