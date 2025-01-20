# @plandek-utils/cache-utils

[![npm version](https://badge.fury.io/js/%40eturino%2Fcache-utils.svg)](https://badge.fury.io/js/%40eturino%2Fcache-utils)
[![Node.js Version](https://img.shields.io/node/v/@eturino/cache-utils.svg)](https://nodejs.org)
[![Maintainability](https://api.codeclimate.com/v1/badges/f05fb327b37d0d69b030/maintainability)](https://codeclimate.com/github/plandek-utils/cache-utils/maintainability)
[![Test Coverage](https://api.codeclimate.com/v1/badges/f05fb327b37d0d69b030/test_coverage)](https://codeclimate.com/github/plandek-utils/cache-utils/test_coverage)

`CleanableRedisCache`, a `KeyValueCache`-compatible class, which allows for cleaning by pattern. It stores string values.

## Installation

```bash
npm install @plandek-utils/cache-utils
# or
yarn add @plandek-utils/cache-utils
```

## Usage

### `PlainObjectCache`

Adaptor for a `KeyValueCache<string>` to `KeyValueCache<PlainObject>`, using JSON.parse and JSON.stringify

```ts
import { PlainObjectCache } from "@plandek-utils/cache-utils";

async function doStuff(internalCache: KeyValueCache<string>) {
  const cache = new PlainObjectCache(internalCache);

  await cache.get("missing"); // Promise of undefined
  await cache.set("some-key", { "a": 1 }); // calls internalCache.set("some-key", "{\"a\":1}")
  await cache.get("some-key"); // Promise of { "a": 1 } (parsed)
  await cache.delete("some-key"); // calls internalCache.delete("some-key")
}

```

### `NoOpCache`

`KeyValueCache` that does nothing, useful for tests or to disable cache with minimal impact.

```ts
import { NoOpCache } from "@plandek-utils/cache-utils";

const cache = new NoOpCache<string>();
await cache.get("any-key") // Promise of undefined
await cache.set("any-key", "any value") // Promise of void -> does not store anything in any cache
await cache.delete("any-key") // Promise of void -> does not delete anything from any cache

```

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
import RedisMock from "ioredis-mock";

const redis = new RedisMock({...});
const cleanable = disconnectedCleanableRedisCache(redis);
```

## Development

This package is developed with Node.js and TypeScript. The production code is in `src/mod.ts` and its test in
`src/__tests__/mod.spec.ts`

- `npm run fix`: format and lint files
- `npm run check`: type check and lint files
- `npm test`: run tests
- `npm run test:coverage`: run tests with coverage report
- `npm run build`: build the package
- `npm run prepare-release`: run all checks, tests and build before release

## Creating a New Version

This project uses [light-release](https://github.com/plandek-utils/light-release) for versioning. To create a new version:

1. Make your changes and commit them following conventional commit format
2. Run `npm run prepare-release` to ensure all checks pass
3. Use `npx light-release` to create a new version. This will:
   - Generate release notes
   - Update version in package.json
   - Create a version commit and tag
