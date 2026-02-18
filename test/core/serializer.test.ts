import { describe, it, expect } from "vitest"
import { Effect } from "effect"
import { createSerializer } from "@core/serializer"
import { qInteger, qString, withDefault, qLiteral } from "@core/parsers"

describe("createSerializer", () => {
  const serialize = createSerializer({
    page: withDefault(qInteger, 1),
    sort: withDefault(qLiteral("asc", "desc"), "asc"),
    q: qString,
  })

  it("builds query string from values", () => {
    const url = Effect.runSync(
      serialize("/products", { page: 2, q: "shoes" })
    )
    expect(url).toContain("/products?")
    expect(url).toContain("page=2")
    expect(url).toContain("q=shoes")
  })

  it("omits null values", () => {
    const url = Effect.runSync(
      serialize("/products", { page: 2, q: null })
    )
    expect(url).toContain("page=2")
    expect(url).not.toContain("q=")
  })

  it("omits undefined values", () => {
    const url = Effect.runSync(
      serialize("/products", { page: 2 })
    )
    expect(url).toContain("page=2")
    expect(url).not.toContain("sort=")
    expect(url).not.toContain("q=")
  })

  it("omits default values", () => {
    const url = Effect.runSync(
      serialize("/products", { page: 1, sort: "asc", q: "shoes" })
    )
    expect(url).not.toContain("page=")
    expect(url).not.toContain("sort=")
    expect(url).toContain("q=shoes")
  })

  it("returns base path when no effective params", () => {
    const url = Effect.runSync(
      serialize("/products", { page: 1, sort: "asc" })
    )
    expect(url).toBe("/products")
  })

  it("returns base path for empty values", () => {
    const url = Effect.runSync(serialize("/products", {}))
    expect(url).toBe("/products")
  })
})
