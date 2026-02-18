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

export const createStatefulMockAdapter = (initialSearch: string) => {
  let currentParams = new URLSearchParams(initialSearch)
  const listeners: Array<() => void> = []

  const layer = Layer.succeed(URLAdapterTag, {
    getSearchParams: Effect.sync(() => new URLSearchParams(currentParams.toString())),
    setSearchParams: (params: URLSearchParams, _options: { readonly history: "push" | "replace" }) =>
      Effect.sync(() => {
        currentParams = params
        listeners.forEach((l) => l())
      }),
    subscribe: (listener: () => void) =>
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
