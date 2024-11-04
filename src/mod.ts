import type { KeyValueCache, KeyValueCacheSetOptions } from "@apollo/utils.keyvaluecache";
import { redisDelByPattern, RedisDeletionMethod } from "@eturino/ioredis-del-by-pattern";
import type { PlainObject } from "@plandek-utils/plain-object";
import type { Redis } from "ioredis";

/**
 * Function to delete keys by pattern.
 */
export type DelFn = typeof redisDelByPattern;

/**
 * Util to generate the prefix for the main cache of a client.
 *
 * @param clientKey
 * @returns `ck-${clientKey}|`
 */
export function clientMainCachePrefix(clientKey: string): string {
  return `ck-${clientKey}|`;
}

type ConstructorParams = {
  /**
   * Redis client
   */
  redis: Redis;

  /**
   * Function to delete keys by pattern.
   * If not present, then `redisDelByPattern` from `@eturino/ioredis-del-by-pattern` will be used
   *
   * @see redisDelByPattern
   */
  delFn?: DelFn;

  /**
   * Mandatory prefix for all the keys in this cache, which will be prepended to all keys in REDIS
   */
  keyPrefix: string;

  /**
   * Default TTL for cache entries in seconds
   */
  defaultTTLSeconds: number;

  /**
   * If true, it will be sent to the delFn when cleaning the cache
   */
  enableLog: boolean;
};

/**
 * uses ioredis directly to implement a redis cache that can be cleaned by pattern
 */
export class CleanableRedisCache implements KeyValueCache<string> {
  readonly delFn: DelFn;
  readonly redis: Redis;
  readonly keyPrefix: string;
  readonly defaultCacheTTL: number;
  readonly enableLog: boolean;

  constructor(opts: ConstructorParams) {
    const { delFn, enableLog, keyPrefix, defaultTTLSeconds, redis } = opts;
    this.redis = redis;
    this.keyPrefix = keyPrefix;
    this.defaultCacheTTL = defaultTTLSeconds;
    this.enableLog = enableLog;

    this.delFn = delFn || redisDelByPattern;
  }

  /**
   * Disconnects the redis client
   */
  public disconnect(): void {
    this.redis.disconnect();
  }

  /**
   * Loads the value from the cache (STRING) or undefined if not found
   *
   * @param givenKey Key to identify the cache entry
   * @returns
   */
  public async get(givenKey: string): Promise<string | undefined> {
    const key = this.finalKeyFor(givenKey);
    const value = await this.redis.get(key);

    return isNil(value) ? undefined : value;
  }

  /**
   * Deletes the cache entry using `redis.unlink`.
   *
   * Calls `finalKeyFor` to get the final key to be used in REDIS.
   *
   * @param givenKey Key to identify the cache entry
   */
  public async delete(givenKey: string): Promise<void> {
    const key = this.finalKeyFor(givenKey);
    await this.redis.unlink(key);
  }

  /**
   * Sets a value in the cache for the given key, using `redis.set` with `PX`.
   *
   * Calls `finalKeyFor` to get the final key to be used in REDIS.
   *
   * It does nothing if the value is `undefined`.
   *
   * @param givenKey Key to identify the cache entry
   * @param value Value to be stored in the cache
   * @param options Options for the cache entry
   * @param options.ttl TTL to use instead of the default this.defaultCacheTTL
   */
  public async set(givenKey: string, value: string, options?: KeyValueCacheSetOptions): Promise<void> {
    if (typeof value === "undefined") {
      return;
    }

    const key = this.finalKeyFor(givenKey);
    const ttlSeconds = options?.ttl ?? this.defaultCacheTTL;
    await this.redis.set(key, value, "PX", ttlSeconds * 1000);
  }

  /**
   * Clears all the cache entries for this cache.
   */
  public clearAll(): Promise<number> {
    return this.clean("");
  }

  /**
   * Clears all the response entries (fqc:*) for this cache.
   *
   * It is the prefix added by the Apollo Server cache plugin
   */
  public clearResponseCache(): Promise<number> {
    return this.clean("fqc:"); // prefix added by the Apollo Server cache plugin
  }

  /**
   * Clears all the cache entries for the given client.
   *
   * Uses `clientMainCachePrefix` to generate the prefix.
   *
   * @param clientKey
   * @returns the number of entries cleared
   * @see clientMainCachePrefix
   */
  public clearClient(clientKey: string): Promise<number> {
    return this.clean(clientMainCachePrefix(clientKey));
  }

  /**
   * Clears all the cache entries for the given prefix.
   *
   * @param prefix
   * @returns the number of entries cleared
   */
  public clearPrefix(prefix: string): Promise<number> {
    return this.clean(prefix);
  }

  /**
   * Deletes all cache entries using `delFn` with the given prefix, using `unlink` with Pipeline.
   *
   * Calls `finalKeyFor` to get the final pattern to be used in REDIS.
   *
   * @param prefix
   * @returns the number of entries cleared
   */
  protected clean(prefix: string): Promise<number> {
    return this.delFn({
      pattern: `${this.finalKeyFor(prefix)}*`,
      redis: this.redis,
      deletionMethod: RedisDeletionMethod.unlink,
      withPipeline: true,
      enableLog: this.enableLog,
    });
  }

  protected finalKeyFor(key: string): string {
    return `${this.keyPrefix}${key}`;
  }
}

/**
 * returns a DISCONNECTED CleanableRedisCache, useful for tests.
 */
export function disconnectedCleanableRedisCache(redis: Redis, delFn?: DelFn): CleanableRedisCache {
  const c = new CleanableRedisCache({
    redis,
    delFn,
    defaultTTLSeconds: 0,
    enableLog: false,
    keyPrefix: "<test>",
  });
  c.disconnect();
  return c;
}

/**
 * Adaptor for a KeyValueCache<string> to KeyValueCache<PlainObject>, using JSON.parse and JSON.stringify
 */
export class PlainObjectCache implements KeyValueCache<PlainObject> {
  constructor(readonly cache: KeyValueCache<string>) {}

  /**
   * Calls `cache.get` with the given key and parses the value as JSON if it is truthy, undefined otherwise.
   * @param key
   * @returns
   */
  public async get(key: string): Promise<PlainObject | undefined> {
    const value = await this.cache.get(key);
    return value ? JSON.parse(value) : undefined;
  }

  /**
   * Calls `cache.set` with the given key and value, stringifying the value.
   * @param key
   * @param value
   * @param options
   * @returns
   */
  public set(key: string, value: PlainObject, options?: KeyValueCacheSetOptions): Promise<void> {
    return this.cache.set(key, JSON.stringify(value), options);
  }

  /**
   * Calls `cache.delete` with the given key.
   * @param key
   * @returns
   */
  public delete(key: string): Promise<boolean | void> {
    return this.cache.delete(key);
  }
}

/**
 * KeyValueCache that does nothing, useful for tests or to disable cache with minimal impact.
 */
export class NoOpCache<T = unknown> implements KeyValueCache<T> {
  /**
   * Always returns `undefined`
   * @returns Promise<undefined>
   */
  get(_key: string): Promise<T | undefined> {
    return Promise.resolve(undefined);
  }

  /**
   * Does nothing
   * @returns Promise<void>
   */
  set(_key: string, _value: T, _options?: KeyValueCacheSetOptions | undefined): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Does nothing
   * @returns Promise<void>
   */
  delete(_key: string): Promise<boolean | void> {
    return Promise.resolve();
  }
}

// INTERNAL

function isNil(value: unknown): value is null | undefined {
  return value === undefined || value === null;
}
