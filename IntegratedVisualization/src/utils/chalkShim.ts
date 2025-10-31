// Browser-safe shim for 'chalk' used in LINKVIEW core error formatting.
// Provides minimal API: bgYellow, yellow, and chained bgYellow.red.
const chalk: any = {
  bgYellow: (s: string) => s,
  yellow: (s: string) => s,
};
chalk.bgYellow.red = (s: string) => s;
export default chalk;