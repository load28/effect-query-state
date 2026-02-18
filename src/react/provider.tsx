import { createContext, useContext, useRef, type ReactNode } from "react"
import { Layer, ManagedRuntime } from "effect"
import type { URLAdapter } from "../core/adapter.js"
import { URLAdapterTag } from "../core/adapter.js"
import { BrowserURLAdapterLayer } from "./adapter.js"

type QueryRuntime = ManagedRuntime.ManagedRuntime<URLAdapterTag, never>

const QueryRuntimeContext = createContext<QueryRuntime | null>(null)

export interface QueryProviderProps {
  readonly adapter?: Layer.Layer<URLAdapterTag>
  readonly children: ReactNode
}

export function QueryProvider({ adapter, children }: QueryProviderProps) {
  const runtimeRef = useRef<QueryRuntime | null>(null)
  if (runtimeRef.current === null) {
    runtimeRef.current = ManagedRuntime.make(adapter ?? BrowserURLAdapterLayer)
  }
  return (
    <QueryRuntimeContext.Provider value={runtimeRef.current}>
      {children}
    </QueryRuntimeContext.Provider>
  )
}

export const useQueryRuntime = (): QueryRuntime => {
  const runtime = useContext(QueryRuntimeContext)
  if (runtime === null) {
    throw new Error("useQueryRuntime must be used within a <QueryProvider>")
  }
  return runtime
}
