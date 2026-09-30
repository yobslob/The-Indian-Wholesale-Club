declare const tokens: {
  colors: Record<
    | 'canvas'
    | 'surface'
    | 'paper'
    | 'ink'
    | 'ink-muted'
    | 'line'
    | 'brand'
    | 'on-brand'
    | 'region'
    | 'land'
    | 'positive'
    | 'caution'
    | 'danger',
    string
  >;
  radius: Record<'sm' | 'md' | 'lg' | 'pill', string>;
  duration: Record<'fast' | 'base' | 'slow', string>;
  fonts: Record<'hero' | 'display' | 'body' | 'ui' | 'foot', string[]>;
};
export = tokens;
