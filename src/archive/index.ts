/**
 * ============================================================================
 * ARCHIVE MODULE - Record Storage Abstraction
 * ============================================================================
 * 
 * Exports archive implementations:
 * - InMemoryArchive: Fast, ephemeral storage
 * - CacheArchive: Fallback layer via PersistentPerformerCache
 */

export { InMemoryArchive } from './in-memory-archive';
export { CacheArchive } from './cache-archive';
