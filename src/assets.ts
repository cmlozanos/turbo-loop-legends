declare const __BUILD_VERSION__: string;

export function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}?v=${__BUILD_VERSION__}`;
}
