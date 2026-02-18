# Effect-Query Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Effect-TS Schema 기반의 타입 안전한 URL query parameter 관리 라이브러리를 TDD로 구현한다.

**Architecture:** 코어는 Effect만 의존하는 프레임워크 무관 레이어, React 바인딩은 별도 모듈. URLAdapter Service를 Layer로 DI하여 테스트/브라우저 환경을 분리한다. Schema.transform이 파서(decode/encode) 역할을 한다.

**Tech Stack:** bun, TypeScript (strict), Effect-TS, Vitest, @testing-library/react, tsup

---

### Task 0: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `src/core/index.ts` (빈 배럴)
- Create: `src/react/index.ts` (빈 배럴)
- Create: `src/index.ts` (빈 배럴)

**Step 1: Initialize bun project**

```bash
cd /Users/seominyong/Downloads/source/effect-query
bun init -y
```

**Step 2: Install dependencies**

```bash
bun add effect
bun add -d typescript vitest @testing-library/react @testing-library/jest-dom jsdom react react-dom @types/react @types/react-dom tsup
```

**Step 3: Configure tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx",
    "paths": {
      "@core/*": ["./src/core/*"],
      "@react/*": ["./src/react/*"]
    }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "test"]
}
```

**Step 4: Configure vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    include: ["test/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "src/core"),
      "@react": path.resolve(__dirname, "src/react"),
    },
  },
})
```

**Step 5: Create barrel files**

`src/core/index.ts`:
```typescript
// core barrel - will export parsers, params, serializer, errors, adapter
```

`src/react/index.ts`:
```typescript
// react barrel - will export hooks, provider
```

`src/index.ts`:
```typescript
export * from "./core/index.js"
```

**Step 6: Verify setup**

```bash
bun run vitest --version
```

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold project with bun, vitest, effect-ts"
```

---

### Task 1: Tagged Errors

**Files:**
- Create: `src/core/errors.ts`

**Step 1: Implement errors (no test needed — pure data types)**

`src/core/errors.ts`:
```typescript
import { Data } from "effect"

export class ParseError extends Data.TaggedError("ParseError")<{
  readonly key: string
  readonly value: string
  readonly message: string
}> {}

export class SerializeError extends Data.TaggedError("SerializeError")<{
  readonly key: string
  readonly value: unknown
  readonly message: string
}> {}

export class AdapterError extends Data.TaggedError("AdapterError")<{
  readonly operation: "get" | "set"
  readonly message: string
}> {}
```

**Step 2: Export from barrel**

`src/core/index.ts`에 추가:
```typescript
export { ParseError, SerializeError, AdapterError } from "./errors.js"
```

**Step 3: Commit**

```bash
git add src/core/errors.ts src/core/index.ts
git commit -m "feat: add tagged error types (ParseError, SerializeError, AdapterError)"
```

---

### Task 2: Core Parsers — Tests First

**Files:**
- Create: `test/core/parsers.test.ts`
- Create: `src/core/parsers.ts`

**Step 1: Write failing tests for all parsers**

`test/core/parsers.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { Schema, Effect, Exit } from "effect"
import {
  qString,
  qInteger,
  qFloat,
  qBoolean,
  qLiteral,
  qArray,
  qJson,
  withDefault,
  type QueryParser,
} from "@core/parsers"

// helper: decode a string through a parser's schema
const decode = <A>(parser: QueryParser<A>, input: string): A =>
  Schema.decodeUnknownSync(parser.schema)(input)

// helper: encode a value through a parser's schema
const encode = <A>(parser: QueryParser<A>, value: A): string =>
  Schema.encodeSync(parser.schema)(value)

// helper: check decode failure
const decodeFails = <A>(parser: QueryParser<A>, input: string): boolean => {
  const exit = Effect.runSyncExit(Schema.decodeUnknown(parser.schema)(input))
  return Exit.isFailure(exit)
}

describe("qString", () => {
  it("decodes any string as-is", () => {
    expect(decode(qString, "hello")).toBe("hello")
    expect(decode(qString, "")).toBe("")
  })

  it("encodes string as-is", () => {
    expect(encode(qString, "hello")).toBe("hello")
  })
})

describe("qInteger", () => {
  it("decodes valid integer string", () => {
    expect(decode(qInteger, "42")).toBe(42)
    expect(decode(qInteger, "-7")).toBe(-7)
    expect(decode(qInteger, "0")).toBe(0)
  })

  it("fails on non-integer string", () => {
    expect(decodeFails(qInteger, "abc")).toBe(true)
    expect(decodeFails(qInteger, "")).toBe(true)
  })

  it("fails on float string", () => {
    expect(decodeFails(qInteger, "3.14")).toBe(true)
  })

  it("encodes integer to string", () => {
    expect(encode(qInteger, 42)).toBe("42")
    expect(encode(qInteger, -7)).toBe("-7")
  })
})

describe("qFloat", () => {
  it("decodes valid float string", () => {
    expect(decode(qFloat, "3.14")).toBe(3.14)
    expect(decode(qFloat, "42")).toBe(42)
    expect(decode(qFloat, "-0.5")).toBe(-0.5)
  })

  it("fails on non-numeric string", () => {
    expect(decodeFails(qFloat, "abc")).toBe(true)
    expect(decodeFails(qFloat, "")).toBe(true)
  })

  it("encodes float to string", () => {
    expect(encode(qFloat, 3.14)).toBe("3.14")
  })
})

describe("qBoolean", () => {
  it("decodes 'true' to true", () => {
    expect(decode(qBoolean, "true")).toBe(true)
  })

  it("decodes 'false' to false", () => {
    expect(decode(qBoolean, "false")).toBe(false)
  })

  it("fails on invalid string", () => {
    expect(decodeFails(qBoolean, "yes")).toBe(true)
    expect(decodeFails(qBoolean, "1")).toBe(true)
    expect(decodeFails(qBoolean, "")).toBe(true)
  })

  it("encodes boolean to string", () => {
    expect(encode(qBoolean, true)).toBe("true")
    expect(encode(qBoolean, false)).toBe("false")
  })
})

describe("qLiteral", () => {
  const parser = qLiteral("asc", "desc")

  it("decodes valid literal", () => {
    expect(decode(parser, "asc")).toBe("asc")
    expect(decode(parser, "desc")).toBe("desc")
  })

  it("fails on unknown literal", () => {
    expect(decodeFails(parser, "random")).toBe(true)
    expect(decodeFails(parser, "")).toBe(true)
  })

  it("encodes literal to string", () => {
    expect(encode(parser, "asc")).toBe("asc")
  })
})

describe("qArray", () => {
  const parser = qArray(qInteger)

  it("decodes comma-separated integers", () => {
    expect(decode(parser, "1,2,3")).toEqual([1, 2, 3])
  })

  it("decodes single value", () => {
    expect(decode(parser, "42")).toEqual([42])
  })

  it("fails on invalid element", () => {
    expect(decodeFails(parser, "1,abc,3")).toBe(true)
  })

  it("encodes array to comma-separated string", () => {
    expect(encode(parser, [1, 2, 3])).toBe("1,2,3")
  })
})

describe("qJson", () => {
  const ItemSchema = Schema.Struct({
    name: Schema.String,
    count: Schema.Number,
  })
  const parser = qJson(ItemSchema)

  it("decodes valid JSON matching schema", () => {
    expect(decode(parser, '{"name":"a","count":1}')).toEqual({
      name: "a",
      count: 1,
    })
  })

  it("fails on invalid JSON", () => {
    expect(decodeFails(parser, "not json")).toBe(true)
  })

  it("fails on schema mismatch", () => {
    expect(decodeFails(parser, '{"name":"a","count":"x"}')).toBe(true)
  })

  it("encodes value to JSON string", () => {
    const result = encode(parser, { name: "a", count: 1 })
    expect(JSON.parse(result)).toEqual({ name: "a", count: 1 })
  })
})

describe("withDefault", () => {
  it("attaches default value to parser", () => {
    const parser = withDefault(qInteger, 1)
    expect(parser.defaultValue).toBe(1)
  })

  it("preserves original schema behavior", () => {
    const parser = withDefault(qInteger, 1)
    expect(decode(parser, "5")).toBe(5)
    expect(encode(parser, 5)).toBe("5")
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
bun run vitest run test/core/parsers.test.ts
```
Expected: FAIL — module `@core/parsers` not found.

**Step 3: Implement parsers**

`src/core/parsers.ts`:
```typescript
import { Schema } from "effect"

export interface QueryParser<A> {
  readonly schema: Schema.Schema<A, string>
  readonly defaultValue?: A
}

export const qString: QueryParser<string> = {
  schema: Schema.String,
}

export const qInteger: QueryParser<number> = {
  schema: Schema.transformOrFail(Schema.String, Schema.Number, {
    strict: true,
    decode: (s, _, ast) => {
      const n = Number(s)
      if (!Number.isInteger(n) || s.trim() === "") {
        return Effect.fail(new ParseResult.Type(ast, s, "Expected integer string"))
      }
      return Effect.succeed(n)
    },
    encode: (n) => Effect.succeed(String(n)),
  }),
}

export const qFloat: QueryParser<number> = {
  schema: Schema.transformOrFail(Schema.String, Schema.Number, {
    strict: true,
    decode: (s, _, ast) => {
      const n = Number(s)
      if (Number.isNaN(n) || s.trim() === "") {
        return Effect.fail(new ParseResult.Type(ast, s, "Expected numeric string"))
      }
      return Effect.succeed(n)
    },
    encode: (n) => Effect.succeed(String(n)),
  }),
}

export const qBoolean: QueryParser<boolean> = {
  schema: Schema.transform(Schema.Literal("true", "false"), Schema.Boolean, {
    strict: true,
    decode: (s) => s === "true",
    encode: (b) => (b ? "true" as const : "false" as const),
  }),
}

export const qLiteral = <L extends string>(
  ...literals: readonly [L, ...L[]]
): QueryParser<L> => ({
  schema: Schema.transform(
    Schema.Literal(...literals),
    Schema.Union(...literals.map((l) => Schema.Literal(l))),
    {
      strict: true,
      decode: (s) => s as L,
      encode: (l) => l,
    }
  ) as unknown as Schema.Schema<L, string>,
})

export const qArray = <A>(inner: QueryParser<A>): QueryParser<ReadonlyArray<A>> => ({
  schema: Schema.transformOrFail(
    Schema.String,
    Schema.Array(Schema.typeSchema(inner.schema)),
    {
      strict: true,
      decode: (s, options) => {
        const parts = s.split(",")
        return Effect.all(
          parts.map((part) => Schema.decodeUnknown(inner.schema)(part, options))
        )
      },
      encode: (arr, options) =>
        Effect.all(
          arr.map((item) => Schema.encode(inner.schema)(item, options))
        ).pipe(Effect.map((strs) => strs.join(","))),
    }
  ),
})

export const qJson = <A, I>(
  targetSchema: Schema.Schema<A, I>
): QueryParser<A> => ({
  schema: Schema.transformOrFail(
    Schema.String,
    Schema.typeSchema(targetSchema),
    {
      strict: true,
      decode: (s, options, ast) => {
        let parsed: unknown
        try {
          parsed = JSON.parse(s)
        } catch {
          return Effect.fail(new ParseResult.Type(ast, s, "Invalid JSON"))
        }
        return Schema.decodeUnknown(targetSchema)(parsed, options) as any
      },
      encode: (a, options) =>
        Schema.encode(targetSchema)(a as any, options).pipe(
          Effect.map((encoded) => JSON.stringify(encoded))
        ),
    }
  ),
})

export const withDefault = <A>(
  parser: QueryParser<A>,
  defaultValue: A
): QueryParser<A> => ({
  ...parser,
  defaultValue,
})

// Re-exports needed inside transformOrFail callbacks
import { Effect, ParseResult } from "effect"
```

Note: 위 코드는 초안이며 테스트를 통과시키면서 정확한 Effect API에 맞게 조정한다. `Schema.transform` vs `Schema.transformOrFail`은 실패 가능 여부로 결정한다. `qLiteral`은 `Schema.Literal(...literals)`이 이미 string 검증을 하므로 decode에서 추가 검증 불필요.

**Step 4: Export from barrel**

`src/core/index.ts`에 추가:
```typescript
export {
  type QueryParser,
  qString,
  qInteger,
  qFloat,
  qBoolean,
  qLiteral,
  qArray,
  qJson,
  withDefault,
} from "./parsers.js"
```

**Step 5: Run tests to verify they pass**

```bash
bun run vitest run test/core/parsers.test.ts
```
Expected: all 20+ tests PASS.

**Step 6: Commit**

```bash
git add test/core/parsers.test.ts src/core/parsers.ts src/core/index.ts
git commit -m "feat: add schema-based query parsers with TDD"
```

---

### Task 3: URLAdapter Service Interface

**Files:**
- Create: `src/core/adapter.ts`

**Step 1: Define URLAdapter service**

`src/core/adapter.ts`:
```typescript
import { Context, Effect } from "effect"
import { AdapterError } from "./errors.js"

export interface URLAdapter {
  readonly getSearchParams: Effect.Effect<URLSearchParams, AdapterError>
  readonly setSearchParams: (
    params: URLSearchParams,
    options: { readonly history: "push" | "replace" }
  ) => Effect.Effect<void, AdapterError>
  readonly subscribe: (
    listener: () => void
  ) => Effect.Effect<() => void, AdapterError>
}

export class URLAdapterTag extends Context.Tag("@effect-query/URLAdapter")<
  URLAdapterTag,
  URLAdapter
>() {}
```

**Step 2: Create mock adapter helper for tests**

`test/helpers.ts`:
```typescript
import { Effect, Layer } from "effect"
import { URLAdapterTag, type URLAdapter } from "@core/adapter"

export const createMockAdapter = (
  search: string,
  onSet?: (params: URLSearchParams, options: { history: "push" | "replace" }) => void
): Layer.Layer<URLAdapter> => {
  let currentParams = new URLSearchParams(search)
  return Layer.succeed(URLAdapterTag, {
    getSearchParams: Effect.sync(() => new URLSearchParams(currentParams.toString())),
    setSearchParams: (params, options) =>
      Effect.sync(() => {
        currentParams = params
        onSet?.(params, options)
      }),
    subscribe: (_listener) => Effect.succeed(() => {}),
  })
}
```

**Step 3: Export from barrel**

`src/core/index.ts`에 추가:
```typescript
export { URLAdapterTag, type URLAdapter } from "./adapter.js"
```

**Step 4: Commit**

```bash
git add src/core/adapter.ts test/helpers.ts src/core/index.ts
git commit -m "feat: add URLAdapter service interface and test mock helper"
```

---

### Task 4: Core Params (getParam/setParam) — Tests First

**Files:**
- Create: `test/core/params.test.ts`
- Create: `src/core/params.ts`

**Step 1: Write failing tests**

`test/core/params.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest"
import { Effect, Exit } from "effect"
import { getParam, setParam, getParams, setParams } from "@core/params"
import { qInteger, qString, qBoolean, withDefault } from "@core/parsers"
import { ParseError } from "@core/errors"
import { createMockAdapter } from "../helpers"

describe("getParam", () => {
  it("reads existing param and decodes it", async () => {
    const layer = createMockAdapter("page=3")
    const result = await Effect.runPromise(
      getParam("page", qInteger).pipe(Effect.provide(layer))
    )
    expect(result).toBe(3)
  })

  it("returns null for missing param without default", async () => {
    const layer = createMockAdapter("")
    const result = await Effect.runPromise(
      getParam("page", qInteger).pipe(Effect.provide(layer))
    )
    expect(result).toBeNull()
  })

  it("returns default value for missing param with default", async () => {
    const layer = createMockAdapter("")
    const result = await Effect.runPromise(
      getParam("page", withDefault(qInteger, 1)).pipe(Effect.provide(layer))
    )
    expect(result).toBe(1)
  })

  it("fails with ParseError for invalid value", async () => {
    const layer = createMockAdapter("page=abc")
    const exit = await Effect.runPromiseExit(
      getParam("page", qInteger).pipe(Effect.provide(layer))
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it("reads string param", async () => {
    const layer = createMockAdapter("q=hello+world")
    const result = await Effect.runPromise(
      getParam("q", qString).pipe(Effect.provide(layer))
    )
    expect(result).toBe("hello world")
  })
})

describe("setParam", () => {
  it("sets param in URL", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("", onSet)
    await Effect.runPromise(
      setParam("page", qInteger, 5).pipe(Effect.provide(layer))
    )
    expect(onSet).toHaveBeenCalledTimes(1)
    const [params] = onSet.mock.calls[0]
    expect(params.get("page")).toBe("5")
  })

  it("deletes param when value is null", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("page=3", onSet)
    await Effect.runPromise(
      setParam("page", qInteger, null).pipe(Effect.provide(layer))
    )
    const [params] = onSet.mock.calls[0]
    expect(params.has("page")).toBe(false)
  })

  it("uses replace history by default", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("", onSet)
    await Effect.runPromise(
      setParam("page", qInteger, 1).pipe(Effect.provide(layer))
    )
    const [, options] = onSet.mock.calls[0]
    expect(options.history).toBe("replace")
  })

  it("respects history push option", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("", onSet)
    await Effect.runPromise(
      setParam("page", qInteger, 1, { history: "push" }).pipe(
        Effect.provide(layer)
      )
    )
    const [, options] = onSet.mock.calls[0]
    expect(options.history).toBe("push")
  })

  it("clears param when value equals default (clearOnDefault)", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("page=1", onSet)
    await Effect.runPromise(
      setParam("page", withDefault(qInteger, 1), 1).pipe(
        Effect.provide(layer)
      )
    )
    const [params] = onSet.mock.calls[0]
    expect(params.has("page")).toBe(false)
  })

  it("keeps param when clearOnDefault is false", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("", onSet)
    await Effect.runPromise(
      setParam("page", withDefault(qInteger, 1), 1, {
        clearOnDefault: false,
      }).pipe(Effect.provide(layer))
    )
    const [params] = onSet.mock.calls[0]
    expect(params.get("page")).toBe("1")
  })

  it("preserves other params when setting one", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("sort=asc&q=hello", onSet)
    await Effect.runPromise(
      setParam("page", qInteger, 2).pipe(Effect.provide(layer))
    )
    const [params] = onSet.mock.calls[0]
    expect(params.get("sort")).toBe("asc")
    expect(params.get("q")).toBe("hello")
    expect(params.get("page")).toBe("2")
  })
})

describe("getParams", () => {
  it("reads multiple params at once", async () => {
    const layer = createMockAdapter("page=2&active=true&q=test")
    const result = await Effect.runPromise(
      getParams({
        page: qInteger,
        active: qBoolean,
        q: qString,
      }).pipe(Effect.provide(layer))
    )
    expect(result).toEqual({ page: 2, active: true, q: "test" })
  })

  it("applies defaults for missing params", async () => {
    const layer = createMockAdapter("q=test")
    const result = await Effect.runPromise(
      getParams({
        page: withDefault(qInteger, 1),
        q: qString,
      }).pipe(Effect.provide(layer))
    )
    expect(result).toEqual({ page: 1, q: "test" })
  })
})

describe("setParams", () => {
  it("batch updates multiple params in one URL write", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("", onSet)
    await Effect.runPromise(
      setParams(
        { page: qInteger, q: qString },
        { page: 3, q: "shoes" }
      ).pipe(Effect.provide(layer))
    )
    expect(onSet).toHaveBeenCalledTimes(1)
    const [params] = onSet.mock.calls[0]
    expect(params.get("page")).toBe("3")
    expect(params.get("q")).toBe("shoes")
  })

  it("partial update preserves other existing params", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("page=1&q=old&sort=asc", onSet)
    await Effect.runPromise(
      setParams(
        { page: qInteger, q: qString },
        { page: 2 }
      ).pipe(Effect.provide(layer))
    )
    const [params] = onSet.mock.calls[0]
    expect(params.get("page")).toBe("2")
    expect(params.get("sort")).toBe("asc")
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
bun run vitest run test/core/params.test.ts
```
Expected: FAIL — module `@core/params` not found.

**Step 3: Implement params**

`src/core/params.ts`:
```typescript
import { Effect, Schema } from "effect"
import { URLAdapterTag } from "./adapter.js"
import { ParseError, SerializeError } from "./errors.js"
import type { QueryParser } from "./parsers.js"

export interface SetOptions {
  readonly history?: "push" | "replace"
  readonly clearOnDefault?: boolean
}

export const getParam = <A>(
  key: string,
  parser: QueryParser<A>
): Effect.Effect<A | null, ParseError, URLAdapter> =>
  Effect.gen(function* () {
    const adapter = yield* URLAdapterTag
    const params = yield* adapter.getSearchParams
    const raw = params.get(key)

    if (raw === null) {
      return parser.defaultValue ?? null
    }

    return yield* Schema.decodeUnknown(parser.schema)(raw).pipe(
      Effect.mapError(
        (e) => new ParseError({ key, value: raw, message: String(e) })
      )
    )
  })

export const setParam = <A>(
  key: string,
  parser: QueryParser<A>,
  value: A | null,
  options?: SetOptions
): Effect.Effect<void, SerializeError, URLAdapter> =>
  Effect.gen(function* () {
    const adapter = yield* URLAdapterTag
    const params = yield* adapter.getSearchParams

    if (value === null) {
      params.delete(key)
    } else {
      const clearOnDefault = options?.clearOnDefault !== false
      if (
        clearOnDefault &&
        parser.defaultValue !== undefined &&
        JSON.stringify(value) === JSON.stringify(parser.defaultValue)
      ) {
        params.delete(key)
      } else {
        const encoded = yield* Schema.encode(parser.schema)(value).pipe(
          Effect.mapError(
            (e) =>
              new SerializeError({ key, value, message: String(e) })
          )
        )
        params.set(key, encoded)
      }
    }

    yield* adapter.setSearchParams(params, {
      history: options?.history ?? "replace",
    })
  })

export const getParams = <T extends Record<string, QueryParser<any>>>(
  parsers: T
): Effect.Effect<
  { [K in keyof T]: T[K] extends QueryParser<infer A> ? A | null : never },
  ParseError,
  URLAdapter
> =>
  Effect.gen(function* () {
    const result: Record<string, any> = {}
    for (const [key, parser] of Object.entries(parsers)) {
      result[key] = yield* getParam(key, parser)
    }
    return result as any
  })

export const setParams = <T extends Record<string, QueryParser<any>>>(
  parsers: T,
  values: Partial<{
    [K in keyof T]: T[K] extends QueryParser<infer A> ? A | null : never
  }>,
  options?: SetOptions
): Effect.Effect<void, SerializeError, URLAdapter> =>
  Effect.gen(function* () {
    const adapter = yield* URLAdapterTag
    const params = yield* adapter.getSearchParams

    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) continue
      const parser = parsers[key]

      if (value === null) {
        params.delete(key)
      } else {
        const encoded = yield* Schema.encode(parser.schema)(value).pipe(
          Effect.mapError(
            (e) => new SerializeError({ key, value, message: String(e) })
          )
        )
        params.set(key, encoded)
      }
    }

    yield* adapter.setSearchParams(params, {
      history: options?.history ?? "replace",
    })
  })

// Type import for service
import type { URLAdapter } from "./adapter.js"
```

**Step 4: Export from barrel**

`src/core/index.ts`에 추가:
```typescript
export { getParam, setParam, getParams, setParams, type SetOptions } from "./params.js"
```

**Step 5: Run tests**

```bash
bun run vitest run test/core/params.test.ts
```
Expected: all tests PASS.

**Step 6: Commit**

```bash
git add test/core/params.test.ts src/core/params.ts src/core/index.ts test/helpers.ts
git commit -m "feat: add getParam/setParam/getParams/setParams with TDD"
```

---

### Task 5: Serializer — Tests First

**Files:**
- Create: `test/core/serializer.test.ts`
- Create: `src/core/serializer.ts`

**Step 1: Write failing tests**

`test/core/serializer.test.ts`:
```typescript
import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { createSerializer } from "@core/serializer"
import { qInteger, qString, withDefault, qLiteral } from "@core/parsers"

describe("createSerializer", () => {
  const serialize = createSerializer({
    page: withDefault(qInteger, 1),
    sort: withDefault(qLiteral("asc", "desc"), "asc"),
    q: qString,
  })

  it("builds query string from values", () => {
    const url = Effect.runSync(
      serialize("/products", { page: 2, q: "shoes" })
    )
    expect(url).toContain("/products?")
    expect(url).toContain("page=2")
    expect(url).toContain("q=shoes")
  })

  it("omits null values", () => {
    const url = Effect.runSync(
      serialize("/products", { page: 2, q: null })
    )
    expect(url).toContain("page=2")
    expect(url).not.toContain("q=")
  })

  it("omits undefined values", () => {
    const url = Effect.runSync(
      serialize("/products", { page: 2 })
    )
    expect(url).toContain("page=2")
    expect(url).not.toContain("sort=")
    expect(url).not.toContain("q=")
  })

  it("omits default values", () => {
    const url = Effect.runSync(
      serialize("/products", { page: 1, sort: "asc", q: "shoes" })
    )
    // page=1 and sort=asc are defaults, should be omitted
    expect(url).not.toContain("page=")
    expect(url).not.toContain("sort=")
    expect(url).toContain("q=shoes")
  })

  it("returns base path when no effective params", () => {
    const url = Effect.runSync(
      serialize("/products", { page: 1, sort: "asc" })
    )
    expect(url).toBe("/products")
  })

  it("returns base path for empty values", () => {
    const url = Effect.runSync(serialize("/products", {}))
    expect(url).toBe("/products")
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
bun run vitest run test/core/serializer.test.ts
```

**Step 3: Implement serializer**

`src/core/serializer.ts`:
```typescript
import { Effect, Schema } from "effect"
import { SerializeError } from "./errors.js"
import type { QueryParser } from "./parsers.js"

export const createSerializer = <T extends Record<string, QueryParser<any>>>(
  parsers: T
) => {
  return (
    base: string,
    values: Partial<{
      [K in keyof T]: (T[K] extends QueryParser<infer A> ? A : never) | null
    }>
  ): Effect.Effect<string, SerializeError> =>
    Effect.gen(function* () {
      const params = new URLSearchParams()

      for (const [key, value] of Object.entries(values)) {
        if (value === null || value === undefined) continue
        const parser = parsers[key]

        // Skip default values
        if (
          parser.defaultValue !== undefined &&
          JSON.stringify(value) === JSON.stringify(parser.defaultValue)
        ) {
          continue
        }

        const encoded = yield* Schema.encode(parser.schema)(value).pipe(
          Effect.mapError(
            (e) => new SerializeError({ key, value, message: String(e) })
          )
        )
        params.set(key, encoded)
      }

      const qs = params.toString()
      return qs ? `${base}?${qs}` : base
    })
}
```

**Step 4: Export from barrel**

`src/core/index.ts`에 추가:
```typescript
export { createSerializer } from "./serializer.js"
```

**Step 5: Run tests**

```bash
bun run vitest run test/core/serializer.test.ts
```

**Step 6: Commit**

```bash
git add test/core/serializer.test.ts src/core/serializer.ts src/core/index.ts
git commit -m "feat: add createSerializer utility with TDD"
```

---

### Task 6: React Provider & BrowserAdapter

**Files:**
- Create: `src/react/adapter.ts`
- Create: `src/react/provider.tsx`

**Step 1: Implement BrowserURLAdapter**

`src/react/adapter.ts`:
```typescript
import { Effect, Layer } from "effect"
import { URLAdapterTag } from "../core/adapter.js"
import { AdapterError } from "../core/errors.js"

export const BrowserURLAdapterLayer = Layer.succeed(URLAdapterTag, {
  getSearchParams: Effect.sync(
    () => new URLSearchParams(window.location.search)
  ),
  setSearchParams: (params, options) =>
    Effect.sync(() => {
      const url = new URL(window.location.href)
      url.search = params.toString()
      if (options.history === "push") {
        window.history.pushState({}, "", url.toString())
      } else {
        window.history.replaceState({}, "", url.toString())
      }
    }),
  subscribe: (listener) =>
    Effect.sync(() => {
      window.addEventListener("popstate", listener)
      return () => window.removeEventListener("popstate", listener)
    }),
})
```

**Step 2: Implement QueryProvider**

`src/react/provider.tsx`:
```typescript
import { createContext, useContext, useRef, type ReactNode } from "react"
import { Layer, ManagedRuntime } from "effect"
import { URLAdapterTag, type URLAdapter } from "../core/adapter.js"
import { BrowserURLAdapterLayer } from "./adapter.js"

type QueryRuntime = ManagedRuntime.ManagedRuntime<URLAdapter, never>

const QueryRuntimeContext = createContext<QueryRuntime | null>(null)

export interface QueryProviderProps {
  readonly adapter?: Layer.Layer<URLAdapter>
  readonly children: ReactNode
}

export function QueryProvider({ adapter, children }: QueryProviderProps) {
  const runtimeRef = useRef<QueryRuntime | null>(null)

  if (runtimeRef.current === null) {
    runtimeRef.current = ManagedRuntime.make(
      adapter ?? BrowserURLAdapterLayer
    )
  }

  return (
    <QueryRuntimeContext.Provider value={runtimeRef.current}>
      {children}
    </QueryRuntimeContext.Provider>
  )
}

export const useQueryRuntime = (): QueryRuntime => {
  const runtime = useContext(QueryRuntimeContext)
  if (runtime === null) {
    throw new Error("useQueryRuntime must be used within a <QueryProvider>")
  }
  return runtime
}
```

**Step 3: Export from barrel**

`src/react/index.ts`:
```typescript
export { BrowserURLAdapterLayer } from "./adapter.js"
export { QueryProvider, useQueryRuntime, type QueryProviderProps } from "./provider.js"
```

**Step 4: Commit**

```bash
git add src/react/adapter.ts src/react/provider.tsx src/react/index.ts
git commit -m "feat: add QueryProvider and BrowserURLAdapter"
```

---

### Task 7: useQueryState Hook — Tests First

**Files:**
- Create: `test/react/useQueryState.test.tsx`
- Create: `src/react/useQueryState.ts`

**Step 1: Write failing tests**

`test/react/useQueryState.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { type ReactNode } from "react"
import { Effect, Layer } from "effect"
import { QueryProvider } from "@react/provider"
import { useQueryState } from "@react/useQueryState"
import { qInteger, qString, withDefault } from "@core/parsers"
import { URLAdapterTag } from "@core/adapter"

// Stateful mock adapter for React tests
const createStatefulMockAdapter = (initialSearch: string) => {
  let currentParams = new URLSearchParams(initialSearch)
  const listeners: Array<() => void> = []

  const layer = Layer.succeed(URLAdapterTag, {
    getSearchParams: Effect.sync(
      () => new URLSearchParams(currentParams.toString())
    ),
    setSearchParams: (params, _options) =>
      Effect.sync(() => {
        currentParams = params
        listeners.forEach((l) => l())
      }),
    subscribe: (listener) =>
      Effect.sync(() => {
        listeners.push(listener)
        return () => {
          const idx = listeners.indexOf(listener)
          if (idx >= 0) listeners.splice(idx, 1)
        }
      }),
  })

  return { layer, getParams: () => currentParams }
}

const createWrapper =
  (adapter: Layer.Layer<any>) =>
  ({ children }: { children: ReactNode }) => (
    <QueryProvider adapter={adapter}>{children}</QueryProvider>
  )

describe("useQueryState", () => {
  it("reads initial value from URL", async () => {
    const { layer } = createStatefulMockAdapter("page=3")
    const { result } = renderHook(
      () => useQueryState("page", qInteger),
      { wrapper: createWrapper(layer) }
    )

    await vi.waitFor(() => {
      expect(result.current[0]).toBe(3)
    })
  })

  it("returns null when param is missing and no default", async () => {
    const { layer } = createStatefulMockAdapter("")
    const { result } = renderHook(
      () => useQueryState("page", qInteger),
      { wrapper: createWrapper(layer) }
    )

    await vi.waitFor(() => {
      expect(result.current[0]).toBeNull()
    })
  })

  it("returns default when param is missing", async () => {
    const { layer } = createStatefulMockAdapter("")
    const { result } = renderHook(
      () => useQueryState("page", withDefault(qInteger, 1)),
      { wrapper: createWrapper(layer) }
    )

    await vi.waitFor(() => {
      expect(result.current[0]).toBe(1)
    })
  })

  it("updates value and URL on setValue", async () => {
    const { layer, getParams } = createStatefulMockAdapter("page=1")
    const { result } = renderHook(
      () => useQueryState("page", qInteger),
      { wrapper: createWrapper(layer) }
    )

    await vi.waitFor(() => {
      expect(result.current[0]).toBe(1)
    })

    act(() => {
      result.current[1](5)
    })

    await vi.waitFor(() => {
      expect(result.current[0]).toBe(5)
      expect(getParams().get("page")).toBe("5")
    })
  })

  it("removes param from URL when set to null", async () => {
    const { layer, getParams } = createStatefulMockAdapter("page=3")
    const { result } = renderHook(
      () => useQueryState("page", qInteger),
      { wrapper: createWrapper(layer) }
    )

    await vi.waitFor(() => {
      expect(result.current[0]).toBe(3)
    })

    act(() => {
      result.current[1](null)
    })

    await vi.waitFor(() => {
      expect(result.current[0]).toBeNull()
      expect(getParams().has("page")).toBe(false)
    })
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
bun run vitest run test/react/useQueryState.test.tsx
```

**Step 3: Implement useQueryState**

`src/react/useQueryState.ts`:
```typescript
import { useState, useEffect, useCallback } from "react"
import { Effect } from "effect"
import { getParam, setParam, type SetOptions } from "../core/params.js"
import type { QueryParser } from "../core/parsers.js"
import { useQueryRuntime } from "./provider.js"

export function useQueryState<A>(
  key: string,
  parser: QueryParser<A>
): [A | null, (value: A | null, options?: SetOptions) => void] {
  const runtime = useQueryRuntime()
  const [state, setState] = useState<A | null>(parser.defaultValue ?? null)

  useEffect(() => {
    // Read initial value
    runtime.runPromise(getParam(key, parser)).then(setState)

    // Subscribe to URL changes
    let unsubscribe: (() => void) | undefined
    runtime
      .runPromise(
        Effect.gen(function* () {
          const { URLAdapterTag } = yield* import("../core/adapter.js")
          const adapter = yield* URLAdapterTag
          return yield* adapter.subscribe(() => {
            runtime.runPromise(getParam(key, parser)).then(setState)
          })
        })
      )
      .then((unsub) => {
        unsubscribe = unsub
      })

    return () => {
      unsubscribe?.()
    }
  }, [key])

  const setValue = useCallback(
    (value: A | null, options?: SetOptions) => {
      setState(value)
      runtime.runPromise(
        setParam(key, parser, value, options).pipe(
          Effect.catchAll(() => Effect.void)
        )
      )
    },
    [key, parser, runtime]
  )

  return [state, setValue]
}
```

Note: `useEffect` 내부의 subscribe 로직은 adapter import를 직접 하지 않고 별도 Effect로 구성할 수 있다. 테스트 통과 후 리팩터링한다.

**Step 4: Export from barrel**

`src/react/index.ts`에 추가:
```typescript
export { useQueryState } from "./useQueryState.js"
```

**Step 5: Run tests**

```bash
bun run vitest run test/react/useQueryState.test.tsx
```

**Step 6: Commit**

```bash
git add test/react/useQueryState.test.tsx src/react/useQueryState.ts src/react/index.ts
git commit -m "feat: add useQueryState React hook with TDD"
```

---

### Task 8: useQueryStates Hook — Tests First

**Files:**
- Create: `test/react/useQueryStates.test.tsx`
- Create: `src/react/useQueryStates.ts`

**Step 1: Write failing tests**

`test/react/useQueryStates.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { type ReactNode } from "react"
import { Layer, Effect } from "effect"
import { QueryProvider } from "@react/provider"
import { useQueryStates } from "@react/useQueryStates"
import { qInteger, qString, qBoolean, withDefault } from "@core/parsers"
import { URLAdapterTag } from "@core/adapter"

const createStatefulMockAdapter = (initialSearch: string) => {
  let currentParams = new URLSearchParams(initialSearch)
  const listeners: Array<() => void> = []

  const layer = Layer.succeed(URLAdapterTag, {
    getSearchParams: Effect.sync(
      () => new URLSearchParams(currentParams.toString())
    ),
    setSearchParams: (params, _options) =>
      Effect.sync(() => {
        currentParams = params
        listeners.forEach((l) => l())
      }),
    subscribe: (listener) =>
      Effect.sync(() => {
        listeners.push(listener)
        return () => {
          const idx = listeners.indexOf(listener)
          if (idx >= 0) listeners.splice(idx, 1)
        }
      }),
  })

  return { layer, getParams: () => currentParams }
}

const createWrapper =
  (adapter: Layer.Layer<any>) =>
  ({ children }: { children: ReactNode }) => (
    <QueryProvider adapter={adapter}>{children}</QueryProvider>
  )

describe("useQueryStates", () => {
  it("reads multiple params at once", async () => {
    const { layer } = createStatefulMockAdapter("page=2&q=shoes&active=true")
    const { result } = renderHook(
      () =>
        useQueryStates({
          page: qInteger,
          q: qString,
          active: qBoolean,
        }),
      { wrapper: createWrapper(layer) }
    )

    await vi.waitFor(() => {
      expect(result.current[0]).toEqual({
        page: 2,
        q: "shoes",
        active: true,
      })
    })
  })

  it("applies defaults for missing params", async () => {
    const { layer } = createStatefulMockAdapter("q=test")
    const { result } = renderHook(
      () =>
        useQueryStates({
          page: withDefault(qInteger, 1),
          q: qString,
        }),
      { wrapper: createWrapper(layer) }
    )

    await vi.waitFor(() => {
      expect(result.current[0]).toEqual({ page: 1, q: "test" })
    })
  })

  it("batch updates multiple params", async () => {
    const { layer, getParams } = createStatefulMockAdapter("page=1&q=old")
    const { result } = renderHook(
      () =>
        useQueryStates({
          page: qInteger,
          q: qString,
        }),
      { wrapper: createWrapper(layer) }
    )

    await vi.waitFor(() => {
      expect(result.current[0].page).toBe(1)
    })

    act(() => {
      result.current[1]({ page: 3, q: "new" })
    })

    await vi.waitFor(() => {
      expect(result.current[0]).toEqual({ page: 3, q: "new" })
      expect(getParams().get("page")).toBe("3")
      expect(getParams().get("q")).toBe("new")
    })
  })

  it("partial update preserves other state values", async () => {
    const { layer } = createStatefulMockAdapter("page=1&q=test")
    const { result } = renderHook(
      () =>
        useQueryStates({
          page: qInteger,
          q: qString,
        }),
      { wrapper: createWrapper(layer) }
    )

    await vi.waitFor(() => {
      expect(result.current[0].q).toBe("test")
    })

    act(() => {
      result.current[1]({ page: 5 })
    })

    await vi.waitFor(() => {
      expect(result.current[0].page).toBe(5)
      expect(result.current[0].q).toBe("test")
    })
  })

  it("removes param when set to null", async () => {
    const { layer, getParams } = createStatefulMockAdapter("page=3&q=hello")
    const { result } = renderHook(
      () =>
        useQueryStates({
          page: qInteger,
          q: qString,
        }),
      { wrapper: createWrapper(layer) }
    )

    await vi.waitFor(() => {
      expect(result.current[0].q).toBe("hello")
    })

    act(() => {
      result.current[1]({ q: null })
    })

    await vi.waitFor(() => {
      expect(result.current[0].q).toBeNull()
      expect(getParams().has("q")).toBe(false)
    })
  })
})
```

**Step 2: Run tests to verify they fail**

```bash
bun run vitest run test/react/useQueryStates.test.tsx
```

**Step 3: Implement useQueryStates**

`src/react/useQueryStates.ts`:
```typescript
import { useState, useEffect, useCallback } from "react"
import { Effect } from "effect"
import { getParams, setParams, type SetOptions } from "../core/params.js"
import type { QueryParser } from "../core/parsers.js"
import { useQueryRuntime } from "./provider.js"

type InferParserType<P> = P extends QueryParser<infer A> ? A : never

export function useQueryStates<T extends Record<string, QueryParser<any>>>(
  parsers: T
): [
  { [K in keyof T]: InferParserType<T[K]> | null },
  (
    values: Partial<{ [K in keyof T]: InferParserType<T[K]> | null }>,
    options?: SetOptions
  ) => void,
] {
  const runtime = useQueryRuntime()
  type State = { [K in keyof T]: InferParserType<T[K]> | null }

  const [state, setState] = useState<State>(() => {
    const initial: Record<string, any> = {}
    for (const [key, parser] of Object.entries(parsers)) {
      initial[key] = parser.defaultValue ?? null
    }
    return initial as State
  })

  useEffect(() => {
    runtime.runPromise(getParams(parsers)).then((result) => {
      setState(result as State)
    })
  }, [])

  const setValues = useCallback(
    (
      values: Partial<{ [K in keyof T]: InferParserType<T[K]> | null }>,
      options?: SetOptions
    ) => {
      setState((prev) => ({ ...prev, ...values }))
      runtime.runPromise(
        setParams(parsers, values as any, options).pipe(
          Effect.catchAll(() => Effect.void)
        )
      )
    },
    [parsers, runtime]
  )

  return [state, setValues]
}
```

**Step 4: Export from barrel**

`src/react/index.ts`에 추가:
```typescript
export { useQueryStates } from "./useQueryStates.js"
```

**Step 5: Run tests**

```bash
bun run vitest run test/react/useQueryStates.test.tsx
```

**Step 6: Run full test suite**

```bash
bun run vitest run
```
Expected: ALL tests pass.

**Step 7: Commit**

```bash
git add test/react/useQueryStates.test.tsx src/react/useQueryStates.ts src/react/index.ts
git commit -m "feat: add useQueryStates React hook with TDD"
```

---

### Task 9: Final Integration — Barrel Exports & Type Verification

**Files:**
- Modify: `src/index.ts`
- Modify: `src/core/index.ts`
- Modify: `src/react/index.ts`

**Step 1: Finalize all barrel exports**

`src/index.ts`:
```typescript
// Core
export {
  // Parsers
  type QueryParser,
  qString,
  qInteger,
  qFloat,
  qBoolean,
  qLiteral,
  qArray,
  qJson,
  withDefault,
  // Params
  getParam,
  setParam,
  getParams,
  setParams,
  type SetOptions,
  // Serializer
  createSerializer,
  // Errors
  ParseError,
  SerializeError,
  AdapterError,
  // Adapter
  URLAdapterTag,
  type URLAdapter,
} from "./core/index.js"

// React
export {
  QueryProvider,
  useQueryRuntime,
  useQueryState,
  useQueryStates,
  BrowserURLAdapterLayer,
  type QueryProviderProps,
} from "./react/index.js"
```

**Step 2: Type check**

```bash
bunx tsc --noEmit
```

**Step 3: Run full test suite**

```bash
bun run vitest run
```

**Step 4: Commit**

```bash
git add src/index.ts src/core/index.ts src/react/index.ts
git commit -m "feat: finalize barrel exports and type verification"
```
