import { useState, useEffect, useCallback, useRef } from "react"
import { Effect } from "effect"
import { URLAdapterTag } from "../core/adapter.js"
import { getParams, setParams, type SetOptions } from "../core/params.js"
import type { QueryParser } from "../core/parsers.js"
import type { ParseError, SerializeError, AdapterError } from "../core/errors.js"
import { useQueryRuntime } from "./provider.js"

type InferParserType<P> = P extends QueryParser<infer A> ? A : never
type QueryStatesError = ParseError | SerializeError | AdapterError

export function useQueryStates<T extends Record<string, QueryParser<any>>>(
  parsers: T
): [
  { [K in keyof T]: InferParserType<T[K]> | null },
  (
    values: Partial<{ [K in keyof T]: InferParserType<T[K]> | null }>,
    options?: SetOptions
  ) => void,
  QueryStatesError | null,
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
  const [error, setError] = useState<QueryStatesError | null>(null)
  const cleanedRef = useRef(false)

  useEffect(() => {
    cleanedRef.current = false
    let unsubscribe: (() => void) | undefined

    // Read initial values
    runtime.runPromise(getParams(parsers)).then(
      (result) => { if (!cleanedRef.current) setState(result as State) },
      (err) => { if (!cleanedRef.current) setError(err) }
    )

    // Subscribe to URL changes (popstate)
    runtime.runPromise(
      Effect.gen(function* () {
        const adapter = yield* URLAdapterTag
        return yield* adapter.subscribe(() => {
          runtime.runPromise(getParams(parsers)).then(
            (result) => { if (!cleanedRef.current) setState(result as State) },
            (err) => { if (!cleanedRef.current) setError(err) }
          )
        })
      })
    ).then((unsub) => {
      if (cleanedRef.current) {
        unsub()
      } else {
        unsubscribe = unsub
      }
    })

    return () => {
      cleanedRef.current = true
      unsubscribe?.()
    }
  }, [parsers, runtime])

  const setValues = useCallback(
    (
      values: Partial<{ [K in keyof T]: InferParserType<T[K]> | null }>,
      options?: SetOptions
    ) => {
      setState((prev) => ({ ...prev, ...values }))
      setError(null)
      runtime.runPromise(setParams(parsers, values as any, options)).catch(
        (err) => setError(err)
      )
    },
    [parsers, runtime]
  )

  return [state, setValues, error]
}
