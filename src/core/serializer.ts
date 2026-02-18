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
