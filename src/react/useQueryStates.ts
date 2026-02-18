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
