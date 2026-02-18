import { describe, it, expect, vi } from "vitest"
import { Effect, Exit } from "effect"
import { getParam, setParam, getParams, setParams } from "@core/params"
import { qInteger, qString, qBoolean, withDefault } from "@core/parsers"
import { createMockAdapter } from "../helpers"

describe("getParam", () => {
  it("reads existing param and decodes it", async () => {
    const layer = createMockAdapter("page=3")
    const result = await Effect.runPromise(
      getParam("page", qInteger).pipe(Effect.provide(layer))
    )
    expect(result).toBe(3)
  })

  it("returns null for missing param without default", async () => {
    const layer = createMockAdapter("")
    const result = await Effect.runPromise(
      getParam("page", qInteger).pipe(Effect.provide(layer))
    )
    expect(result).toBeNull()
  })

  it("returns default value for missing param with default", async () => {
    const layer = createMockAdapter("")
    const result = await Effect.runPromise(
      getParam("page", withDefault(qInteger, 1)).pipe(Effect.provide(layer))
    )
    expect(result).toBe(1)
  })

  it("fails with ParseError for invalid value", async () => {
    const layer = createMockAdapter("page=abc")
    const exit = await Effect.runPromiseExit(
      getParam("page", qInteger).pipe(Effect.provide(layer))
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })

  it("reads string param", async () => {
    const layer = createMockAdapter("q=hello+world")
    const result = await Effect.runPromise(
      getParam("q", qString).pipe(Effect.provide(layer))
    )
    expect(result).toBe("hello world")
  })
})

describe("setParam", () => {
  it("sets param in URL", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("", onSet)
    await Effect.runPromise(
      setParam("page", qInteger, 5).pipe(Effect.provide(layer))
    )
    expect(onSet).toHaveBeenCalledTimes(1)
    const [params] = onSet.mock.calls[0]
    expect(params.get("page")).toBe("5")
  })

  it("deletes param when value is null", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("page=3", onSet)
    await Effect.runPromise(
      setParam("page", qInteger, null).pipe(Effect.provide(layer))
    )
    const [params] = onSet.mock.calls[0]
    expect(params.has("page")).toBe(false)
  })

  it("uses replace history by default", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("", onSet)
    await Effect.runPromise(
      setParam("page", qInteger, 1).pipe(Effect.provide(layer))
    )
    const [, options] = onSet.mock.calls[0]
    expect(options.history).toBe("replace")
  })

  it("respects history push option", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("", onSet)
    await Effect.runPromise(
      setParam("page", qInteger, 1, { history: "push" }).pipe(Effect.provide(layer))
    )
    const [, options] = onSet.mock.calls[0]
    expect(options.history).toBe("push")
  })

  it("clears param when value equals default (clearOnDefault)", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("page=1", onSet)
    await Effect.runPromise(
      setParam("page", withDefault(qInteger, 1), 1).pipe(Effect.provide(layer))
    )
    const [params] = onSet.mock.calls[0]
    expect(params.has("page")).toBe(false)
  })

  it("keeps param when clearOnDefault is false", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("", onSet)
    await Effect.runPromise(
      setParam("page", withDefault(qInteger, 1), 1, { clearOnDefault: false }).pipe(
        Effect.provide(layer)
      )
    )
    const [params] = onSet.mock.calls[0]
    expect(params.get("page")).toBe("1")
  })

  it("preserves other params when setting one", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("sort=asc&q=hello", onSet)
    await Effect.runPromise(
      setParam("page", qInteger, 2).pipe(Effect.provide(layer))
    )
    const [params] = onSet.mock.calls[0]
    expect(params.get("sort")).toBe("asc")
    expect(params.get("q")).toBe("hello")
    expect(params.get("page")).toBe("2")
  })
})

describe("getParams", () => {
  it("reads multiple params at once", async () => {
    const layer = createMockAdapter("page=2&active=true&q=test")
    const result = await Effect.runPromise(
      getParams({
        page: qInteger,
        active: qBoolean,
        q: qString,
      }).pipe(Effect.provide(layer))
    )
    expect(result).toEqual({ page: 2, active: true, q: "test" })
  })

  it("applies defaults for missing params", async () => {
    const layer = createMockAdapter("q=test")
    const result = await Effect.runPromise(
      getParams({
        page: withDefault(qInteger, 1),
        q: qString,
      }).pipe(Effect.provide(layer))
    )
    expect(result).toEqual({ page: 1, q: "test" })
  })
})

describe("setParams", () => {
  it("batch updates multiple params in one URL write", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("", onSet)
    await Effect.runPromise(
      setParams(
        { page: qInteger, q: qString },
        { page: 3, q: "shoes" }
      ).pipe(Effect.provide(layer))
    )
    expect(onSet).toHaveBeenCalledTimes(1)
    const [params] = onSet.mock.calls[0]
    expect(params.get("page")).toBe("3")
    expect(params.get("q")).toBe("shoes")
  })

  it("partial update preserves other existing params", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("page=1&q=old&sort=asc", onSet)
    await Effect.runPromise(
      setParams(
        { page: qInteger, q: qString },
        { page: 2 }
      ).pipe(Effect.provide(layer))
    )
    const [params] = onSet.mock.calls[0]
    expect(params.get("page")).toBe("2")
    expect(params.get("sort")).toBe("asc")
  })

  it("clears param when value equals default (clearOnDefault)", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("page=1&q=hello", onSet)
    await Effect.runPromise(
      setParams(
        { page: withDefault(qInteger, 1), q: qString },
        { page: 1, q: "updated" }
      ).pipe(Effect.provide(layer))
    )
    const [params] = onSet.mock.calls[0]
    expect(params.has("page")).toBe(false) // default cleared
    expect(params.get("q")).toBe("updated")
  })

  it("keeps default value when clearOnDefault is false", async () => {
    const onSet = vi.fn()
    const layer = createMockAdapter("", onSet)
    await Effect.runPromise(
      setParams(
        { page: withDefault(qInteger, 1) },
        { page: 1 },
        { clearOnDefault: false }
      ).pipe(Effect.provide(layer))
    )
    const [params] = onSet.mock.calls[0]
    expect(params.get("page")).toBe("1")
  })
})
