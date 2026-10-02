export function estimateReadSeconds(item) {
  const chars = Array.from((item.text ?? '').replace(/\s/g, '')).length;
  const count = (item.remoteImages ?? []).length;
  return Math.min(300, Math.max(30, Math.ceil(8 + chars / 350 * 60 + (count ? 5 + (count - 1) * 4 : 0))));
}
