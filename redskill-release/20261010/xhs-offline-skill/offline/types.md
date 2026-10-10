# 数据接口定义

```typescript
export interface FeedPreview { id: string; source: string; token?: string; }
export interface FeedPage { items: FeedPreview[]; nextCursor?: string; }
export interface FeedAdapter {
  readonly mode: string;
  listFeeds(cursor?: string): Promise<FeedPage>;
  getFeedDetail(preview: FeedPreview): Promise<OfflineFeedItem>;
  getImage?(url: string): Promise<{ bytes: Uint8Array; mime: string }>;
}
export interface OfflineFeedItem {
  id: string; source: string; title?: string; text?: string;
  author?: { id?: string; name?: string; avatarUrl?: string };
  remoteImages: string[]; localImages: string[];
  stats?: { likes?: number; comments?: number; collects?: number };
  publishedAt?: string; sourceUrl?: string; estimatedReadSeconds: number; cachedAt: string;
  cacheStatus: 'pending' | 'downloading' | 'ready' | 'partial' | 'failed';
  failedImages?: number; demo?: boolean;
  comments?: OfflineComment[];
  commentSnapshot?: { status: 'complete' | 'partial' | 'unavailable'; cachedCount: number; total?: number; capturedAt?: string };
}
export interface OfflineComment {
  id: string; text: string; author?: { name?: string }; likes?: number;
  replies: OfflineComment[]; replyCount?: number;
}
export interface OfflinePack {
  schemaVersion: 1; id: string; mode: string; targetMinutes: number; reserveRatio: number;
  estimatedMinutes: number; itemCount: number; imageCount: number; failedImages: number;
  sizeBytes: number; createdAt: string; status: 'building' | 'ready' | 'partial' | 'failed';
  itemIds: string[]; issues: string[];
}
export interface PrepareOptions {
  targetMinutes: number; reserveRatio?: number; maxItems?: number; maxPages?: number;
  allowSeenContent?: boolean; maxBytes?: number;
}

```
