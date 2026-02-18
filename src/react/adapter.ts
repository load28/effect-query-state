import { Effect, Layer } from "effect"
import { URLAdapterTag } from "../core/adapter.js"

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
