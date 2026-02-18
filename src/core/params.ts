import { Effect, Equal, Schema } from "effect"
import { URLAdapterTag } from "./adapter.js"
import { AdapterError, ParseError, SerializeError } from "./errors.js"
import type { QueryParser } from "./parsers.js"

const isDefaultValue = <A>(value: A, defaultValue: A | undefined): boolean => {
  if (defaultValue === undefined) return false
  if (Equal.equals(value, defaultValue)) return true
  // fallback for plain objects not implementing Equal
  if (typeof value === "object" && value !== null) {
    try { return JSON.stringify(value) === JSON.stringify(defaultValue) } catch { return false }
  }
  return Object.is(value, defaultValue)
}

export interface SetOptions {
  readonly history?: "push" | "replace"
  readonly clearOnDefault?: boolean
}

export const getParam = <A>(
  key: string,
  parser: QueryParser<A>
): Effect.Effect<A | null, ParseError | AdapterError, URLAdapterTag> =>
  Effect.gen(function* () {
    const adapter = yield* URLAdapterTag
    const params = yield* adapter.getSearchParams
    const raw = params.get(key)

    if (raw === null) {
      return (parser.defaultValue !== undefined ? parser.defaultValue : null) as A | null
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
): Effect.Effect<void, SerializeError | AdapterError, URLAdapterTag> =>
  Effect.gen(function* () {
    const adapter = yield* URLAdapterTag
    const params = yield* adapter.getSearchParams

    if (value === null) {
      params.delete(key)
    } else {
      const clearOnDefault = options?.clearOnDefault !== false
      if (clearOnDefault && isDefaultValue(value, parser.defaultValue)) {
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

export const getParams = <T extends Record<string, QueryParser<any>>>(
  parsers: T
): Effect.Effect<
  { [K in keyof T]: T[K] extends QueryParser<infer A> ? A | null : never },
  ParseError | AdapterError,
  URLAdapterTag
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
    [K in keyof T]: (T[K] extends QueryParser<infer A> ? A : never) | null
  }>,
  options?: SetOptions
): Effect.Effect<void, SerializeError | AdapterError, URLAdapterTag> =>
  Effect.gen(function* () {
    const adapter = yield* URLAdapterTag
    const params = yield* adapter.getSearchParams

    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) continue
      const parser = parsers[key]

      if (value === null) {
        params.delete(key)
      } else {
        const clearOnDefault = options?.clearOnDefault !== false
        if (clearOnDefault && isDefaultValue(value, parser.defaultValue)) {
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
    }

    yield* adapter.setSearchParams(params, {
      history: options?.history ?? "replace",
    })
  })
