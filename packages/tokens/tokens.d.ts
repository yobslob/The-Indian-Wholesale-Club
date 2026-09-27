declare const tokens: {
  colors: Record<
    'canvas' | 'surface' | 'ink' | 'ink-muted' | 'line' | 'brand' | 'region' | 'positive' | 'caution' | 'danger',
    string
  >;
  radius: Record<'sm' | 'md' | 'lg', string>;
  duration: Record<'fast' | 'base' | 'slow', string>;
};
export = tokens;
