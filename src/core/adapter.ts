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
