import { describe, it, expect } from "vitest"
import { Schema, Effect, Exit } from "effect"
import {
  qString,
  qInteger,
  qFloat,
  qBoolean,
  qLiteral,
  qArray,
  qJson,
  withDefault,
  type QueryParser,
} from "@core/parsers"

// helper: decode a string through a parser's schema
const decode = <A>(parser: QueryParser<A>, input: string): A =>
  Schema.decodeUnknownSync(parser.schema)(input)

// helper: encode a value through a parser's schema
const encode = <A>(parser: QueryParser<A>, value: A): string =>
  Schema.encodeSync(parser.schema)(value)

// helper: check decode failure
const decodeFails = <A>(parser: QueryParser<A>, input: string): boolean => {
  const exit = Effect.runSyncExit(Schema.decodeUnknown(parser.schema)(input))
  return Exit.isFailure(exit)
}

describe("qString", () => {
  it("decodes any string as-is", () => {
    expect(decode(qString, "hello")).toBe("hello")
    expect(decode(qString, "")).toBe("")
  })
  it("encodes string as-is", () => {
    expect(encode(qString, "hello")).toBe("hello")
  })
})

describe("qInteger", () => {
  it("decodes valid integer string", () => {
    expect(decode(qInteger, "42")).toBe(42)
    expect(decode(qInteger, "-7")).toBe(-7)
    expect(decode(qInteger, "0")).toBe(0)
  })
  it("fails on non-integer string", () => {
    expect(decodeFails(qInteger, "abc")).toBe(true)
    expect(decodeFails(qInteger, "")).toBe(true)
  })
  it("fails on float string", () => {
    expect(decodeFails(qInteger, "3.14")).toBe(true)
  })
  it("encodes integer to string", () => {
    expect(encode(qInteger, 42)).toBe("42")
    expect(encode(qInteger, -7)).toBe("-7")
  })
})

describe("qFloat", () => {
  it("decodes valid float string", () => {
    expect(decode(qFloat, "3.14")).toBe(3.14)
    expect(decode(qFloat, "42")).toBe(42)
    expect(decode(qFloat, "-0.5")).toBe(-0.5)
  })
  it("fails on non-numeric string", () => {
    expect(decodeFails(qFloat, "abc")).toBe(true)
    expect(decodeFails(qFloat, "")).toBe(true)
  })
  it("encodes float to string", () => {
    expect(encode(qFloat, 3.14)).toBe("3.14")
  })
})

describe("qBoolean", () => {
  it("decodes 'true' to true", () => {
    expect(decode(qBoolean, "true")).toBe(true)
  })
  it("decodes 'false' to false", () => {
    expect(decode(qBoolean, "false")).toBe(false)
  })
  it("fails on invalid string", () => {
    expect(decodeFails(qBoolean, "yes")).toBe(true)
    expect(decodeFails(qBoolean, "1")).toBe(true)
    expect(decodeFails(qBoolean, "")).toBe(true)
  })
  it("encodes boolean to string", () => {
    expect(encode(qBoolean, true)).toBe("true")
    expect(encode(qBoolean, false)).toBe("false")
  })
})

describe("qLiteral", () => {
  const parser = qLiteral("asc", "desc")
  it("decodes valid literal", () => {
    expect(decode(parser, "asc")).toBe("asc")
    expect(decode(parser, "desc")).toBe("desc")
  })
  it("fails on unknown literal", () => {
    expect(decodeFails(parser, "random")).toBe(true)
    expect(decodeFails(parser, "")).toBe(true)
  })
  it("encodes literal to string", () => {
    expect(encode(parser, "asc")).toBe("asc")
  })
})

describe("qArray", () => {
  const parser = qArray(qInteger)
  it("decodes comma-separated integers", () => {
    expect(decode(parser, "1,2,3")).toEqual([1, 2, 3])
  })
  it("decodes single value", () => {
    expect(decode(parser, "42")).toEqual([42])
  })
  it("fails on invalid element", () => {
    expect(decodeFails(parser, "1,abc,3")).toBe(true)
  })
  it("encodes array to comma-separated string", () => {
    expect(encode(parser, [1, 2, 3])).toBe("1,2,3")
  })
})

describe("qJson", () => {
  const ItemSchema = Schema.Struct({
    name: Schema.String,
    count: Schema.Number,
  })
  const parser = qJson(ItemSchema)
  it("decodes valid JSON matching schema", () => {
    expect(decode(parser, '{"name":"a","count":1}')).toEqual({ name: "a", count: 1 })
  })
  it("fails on invalid JSON", () => {
    expect(decodeFails(parser, "not json")).toBe(true)
  })
  it("fails on schema mismatch", () => {
    expect(decodeFails(parser, '{"name":"a","count":"x"}')).toBe(true)
  })
  it("encodes value to JSON string", () => {
    const result = encode(parser, { name: "a", count: 1 })
    expect(JSON.parse(result)).toEqual({ name: "a", count: 1 })
  })
})

describe("withDefault", () => {
  it("attaches default value to parser", () => {
    const parser = withDefault(qInteger, 1)
    expect(parser.defaultValue).toBe(1)
  })
  it("preserves original schema behavior", () => {
    const parser = withDefault(qInteger, 1)
    expect(decode(parser, "5")).toBe(5)
    expect(encode(parser, 5)).toBe("5")
  })
})
