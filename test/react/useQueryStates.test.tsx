import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { type ReactNode } from "react"
import { type Layer } from "effect"
import { QueryProvider } from "@react/provider"
import { useQueryStates } from "@react/useQueryStates"
import { qInteger, qString, qBoolean, withDefault } from "@core/parsers"
import { createStatefulMockAdapter } from "../helpers"

const createWrapper = (adapter: Layer.Layer<any>) =>
  ({ children }: { children: ReactNode }) => (
    <QueryProvider adapter={adapter}>{children}</QueryProvider>
  )

describe("useQueryStates", () => {
  it("reads multiple params at once", async () => {
    const { layer } = createStatefulMockAdapter("page=2&q=shoes&active=true")
    const { result } = renderHook(
      () => useQueryStates({ page: qInteger, q: qString, active: qBoolean }),
      { wrapper: createWrapper(layer) },
    )
    await vi.waitFor(() => {
      expect(result.current[0]).toEqual({ page: 2, q: "shoes", active: true })
    })
  })

  it("applies defaults for missing params", async () => {
    const { layer } = createStatefulMockAdapter("q=test")
    const { result } = renderHook(
      () => useQueryStates({ page: withDefault(qInteger, 1), q: qString }),
      { wrapper: createWrapper(layer) },
    )
    await vi.waitFor(() => {
      expect(result.current[0]).toEqual({ page: 1, q: "test" })
    })
  })

  it("batch updates multiple params", async () => {
    const { layer, getParams } = createStatefulMockAdapter("page=1&q=old")
    const { result } = renderHook(
      () => useQueryStates({ page: qInteger, q: qString }),
      { wrapper: createWrapper(layer) },
    )
    await vi.waitFor(() => {
      expect(result.current[0].page).toBe(1)
    })
    act(() => {
      result.current[1]({ page: 3, q: "new" })
    })
    await vi.waitFor(() => {
      expect(result.current[0]).toEqual({ page: 3, q: "new" })
      expect(getParams().get("page")).toBe("3")
      expect(getParams().get("q")).toBe("new")
    })
  })

  it("partial update preserves other state values", async () => {
    const { layer } = createStatefulMockAdapter("page=1&q=test")
    const { result } = renderHook(
      () => useQueryStates({ page: qInteger, q: qString }),
      { wrapper: createWrapper(layer) },
    )
    await vi.waitFor(() => {
      expect(result.current[0].q).toBe("test")
    })
    act(() => {
      result.current[1]({ page: 5 })
    })
    await vi.waitFor(() => {
      expect(result.current[0].page).toBe(5)
      expect(result.current[0].q).toBe("test")
    })
  })

  it("removes param when set to null", async () => {
    const { layer, getParams } = createStatefulMockAdapter("page=3&q=hello")
    const { result } = renderHook(
      () => useQueryStates({ page: qInteger, q: qString }),
      { wrapper: createWrapper(layer) },
    )
    await vi.waitFor(() => {
      expect(result.current[0].q).toBe("hello")
    })
    act(() => {
      result.current[1]({ q: null })
    })
    await vi.waitFor(() => {
      expect(result.current[0].q).toBeNull()
      expect(getParams().has("q")).toBe(false)
    })
  })

  it("exposes error state as third element", async () => {
    const { layer } = createStatefulMockAdapter("page=1")
    const { result } = renderHook(
      () => useQueryStates({ page: qInteger }),
      { wrapper: createWrapper(layer) },
    )
    await vi.waitFor(() => {
      expect(result.current[2]).toBeNull() // no error
    })
  })
})
