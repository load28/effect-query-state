import { useState, useEffect, useCallback } from "react"
import { Effect } from "effect"
import { URLAdapterTag } from "../core/adapter.js"
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
    runtime.runPromise(getParam(key, parser)).then(setState)

    let unsubscribe: (() => void) | undefined
    runtime
      .runPromise(
        Effect.gen(function* () {
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
