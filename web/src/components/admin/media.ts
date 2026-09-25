/** Shared shape for an uploaded image, as the admin endpoints return it. */
export type MediaAsset = {
  id: string;
  url: string;
  alt: string;
  caption: string | null;
  width: number;
  height: number;
  byte_size: number;
  created_at: string;
};

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
