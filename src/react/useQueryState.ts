import { useState, useEffect, useCallback, useRef } from "react"
import { Effect } from "effect"
import { URLAdapterTag } from "../core/adapter.js"
import { getParam, setParam, type SetOptions } from "../core/params.js"
import type { QueryParser } from "../core/parsers.js"
import type { ParseError, SerializeError, AdapterError } from "../core/errors.js"
import { useQueryRuntime } from "./provider.js"

type QueryStateError = ParseError | SerializeError | AdapterError

export function useQueryState<A>(
  key: string,
  parser: QueryParser<A>
): [A | null, (value: A | null, options?: SetOptions) => void, QueryStateError | null] {
  const runtime = useQueryRuntime()
  const [state, setState] = useState<A | null>(parser.defaultValue ?? null)
  const [error, setError] = useState<QueryStateError | null>(null)
  const cleanedRef = useRef(false)

  useEffect(() => {
    cleanedRef.current = false
    let unsubscribe: (() => void) | undefined

    // Read initial value
    runtime.runPromise(getParam(key, parser)).then(
      (val) => { if (!cleanedRef.current) setState(val) },
      (err) => { if (!cleanedRef.current) setError(err) }
    )

    // Subscribe to URL changes (popstate)
    runtime.runPromise(
      Effect.gen(function* () {
        const adapter = yield* URLAdapterTag
        return yield* adapter.subscribe(() => {
          runtime.runPromise(getParam(key, parser)).then(
            (val) => { if (!cleanedRef.current) setState(val) },
            (err) => { if (!cleanedRef.current) setError(err) }
          )
        })
      })
    ).then((unsub) => {
      if (cleanedRef.current) {
        unsub() // Already unmounted, clean up immediately
      } else {
        unsubscribe = unsub
      }
    })

    return () => {
      cleanedRef.current = true
      unsubscribe?.()
    }
  }, [key, parser, runtime])

  const setValue = useCallback(
    (value: A | null, options?: SetOptions) => {
      setState(value)
      setError(null)
      runtime.runPromise(setParam(key, parser, value, options)).catch(
        (err) => setError(err)
      )
    },
    [key, parser, runtime]
  )

  return [state, setValue, error]
}
