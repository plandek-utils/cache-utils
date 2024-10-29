# @plandek-utils/cache-utils

[![JSR Scope](https://jsr.io/badges/@plandek-utils)](https://jsr.io/@plandek-utils)
[![JSR](https://jsr.io/badges/@plandek-utils/cache-utils)](https://jsr.io/@plandek-utils/cache-utils)
[![JSR Score](https://jsr.io/badges/@plandek-utils/cache-utils/score)](https://jsr.io/@plandek-utils/cache-utils)
[![Maintainability](https://api.codeclimate.com/v1/badges/f05fb327b37d0d69b030/maintainability)](https://codeclimate.com/github/plandek-utils/cache-utils/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/f05fb327b37d0d69b030/test_coverage)](https://codeclimate.com/github/plandek-utils/cache-utils/test_coverage)

`CleanableRedisCache`, a `KeyValueCache`-compatible class, which allows for cleaning by pattern. It stores string values.

## Usage

### `clientMainCachePrefix(clientKey: string): string`

Function that ensures we use the same convention for caching prefixes by clientKey

```ts
import { clientMainCachePrefix } from "@plandek-utils/cache-utils";

clientMainCachePrefix("my-client"); // OUTPUT: ck-my-client|
```

### `CleanableRedisCache`

```ts
import { CleanableRedisCache } from "@plandek-utils/cache-utils";
import { Redis } from "ioredis";

const redis = new Redis({}); // pass the needed options to create the ioredis client

const cache = new CleanableRedisCache({
  redis, // Redis client
  keyPrefix: "this-cache", // Mandatory prefix for all the keys in this cache, which will be prepended to all keys before passing them to REDIS
  defaultTTLSeconds: 300, // Default TTL for cache entries in seconds
  enableLog: true, // If true, it will be sent to the delFn when cleaning the cache
});
// we can also pass `delFn` with the function to be called for delete keys by pattern.
// If not passed, it defaults to `redisDelByPattern` from `@eturino/ioredis-del-by-pattern`

cache.get("my-key"); // Promise of either the value (string) or undefined

cache.set("my-key", "some-value"); // Promise<void>. Stores in the cache, using the given default TTL
cache.set("my-key", "some-value", { ttl: 10 }); // Promise<void>. Stores in the cache, using 10s as TTL

cache.delete("my-key"); // Promise<void>. Calls unlink in redis.

// clearing

cache.clearPrefix("some-prefix"); // calls delFn with the pattern of the given prefix, prepended by this.keyPrefix, and ending with *.

cache.clearAll(); // same as clearPrefix("")
cache.clearResponseCache(); // same as clearPrefix("fqc:")
cache.clearClient("my-client-key"); // same as clearPrefix("ck-my-client-key|")

// disconnection

cache.disconnect(); // calls redis.disconnect()
```


### `disconnectedCleanableRedisCache(redis: Redis, delFn?: DelFn): CleanableRedisCache` for tests

Look at [./src/__tests__/mod.spec.ts](./src/__tests__/mod.spec.ts) for examples.

```ts
import { disconnectedCleanableRedisCache } from "@plandek-utils/cache-utils";

// we can use ioredis-mock for mocking the Redis client

// @ts-types="npm:@types/ioredis-mock"
import redisMock from "ioredis-mock";

const redis = new redisMock.default({...});
const cleanable = disconnectedCleanableRedisCache(redis);
```

## Development

This package is developed with deno 2. The production code is in `src/mod.ts` and its test in
`src/__tests__/mod.spec.ts`

- `deno fmt src`: format files
- `deno lint src`: lint files
- `deno dev`: run tests on each change in mod.ts
- `deno run test && deno run lcov && deno run html`: run the tests with coverage, then convert to lcov and prepare in
  `html_cov` an HTML export of the coverage info.
