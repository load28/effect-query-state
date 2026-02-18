import { describe, it, expect, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { type ReactNode } from "react"
import { type Layer } from "effect"
import { QueryProvider } from "@react/provider"
import { useQueryState } from "@react/useQueryState"
import { qInteger, withDefault } from "@core/parsers"
import { createStatefulMockAdapter } from "../helpers"

const createWrapper = (adapter: Layer.Layer<any>) =>
  ({ children }: { children: ReactNode }) => (
    <QueryProvider adapter={adapter}>{children}</QueryProvider>
  )

describe("useQueryState", () => {
  it("reads initial value from URL", async () => {
    const { layer } = createStatefulMockAdapter("page=3")
    const { result } = renderHook(() => useQueryState("page", qInteger), {
      wrapper: createWrapper(layer),
    })
    await vi.waitFor(() => {
      expect(result.current[0]).toBe(3)
    })
  })

  it("returns null when param is missing and no default", async () => {
    const { layer } = createStatefulMockAdapter("")
    const { result } = renderHook(() => useQueryState("page", qInteger), {
      wrapper: createWrapper(layer),
    })
    await vi.waitFor(() => {
      expect(result.current[0]).toBeNull()
    })
  })

  it("returns default when param is missing", async () => {
    const { layer } = createStatefulMockAdapter("")
    const { result } = renderHook(
      () => useQueryState("page", withDefault(qInteger, 1)),
      { wrapper: createWrapper(layer) },
    )
    await vi.waitFor(() => {
      expect(result.current[0]).toBe(1)
    })
  })

  it("updates value and URL on setValue", async () => {
    const { layer, getParams } = createStatefulMockAdapter("page=1")
    const { result } = renderHook(() => useQueryState("page", qInteger), {
      wrapper: createWrapper(layer),
    })
    await vi.waitFor(() => {
      expect(result.current[0]).toBe(1)
    })
    act(() => {
      result.current[1](5)
    })
    await vi.waitFor(() => {
      expect(result.current[0]).toBe(5)
      expect(getParams().get("page")).toBe("5")
    })
  })

  it("removes param from URL when set to null", async () => {
    const { layer, getParams } = createStatefulMockAdapter("page=3")
    const { result } = renderHook(() => useQueryState("page", qInteger), {
      wrapper: createWrapper(layer),
    })
    await vi.waitFor(() => {
      expect(result.current[0]).toBe(3)
    })
    act(() => {
      result.current[1](null)
    })
    await vi.waitFor(() => {
      expect(result.current[0]).toBeNull()
      expect(getParams().has("page")).toBe(false)
    })
  })

  it("exposes error state as third element", async () => {
    const { layer } = createStatefulMockAdapter("page=3")
    const { result } = renderHook(() => useQueryState("page", qInteger), {
      wrapper: createWrapper(layer),
    })
    await vi.waitFor(() => {
      expect(result.current[2]).toBeNull() // no error
    })
  })
})
