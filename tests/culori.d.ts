declare module "culori" {
  export function parse(color: string): unknown;
  export function converter(
    mode: string
  ): (color: unknown) => { r: number; g: number; b: number } | undefined;
  export function wcagContrast(a: unknown, b: unknown): number;
}
