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
