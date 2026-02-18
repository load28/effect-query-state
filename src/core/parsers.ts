import { Schema, ParseResult, Effect } from "effect"

// ---------------------------------------------------------------------------
// QueryParser interface
// ---------------------------------------------------------------------------

export interface QueryParser<A> {
  readonly schema: Schema.Schema<A, string>
  readonly defaultValue?: A
}

// ---------------------------------------------------------------------------
// qString
// ---------------------------------------------------------------------------

export const qString: QueryParser<string> = {
  schema: Schema.String,
}

// ---------------------------------------------------------------------------
// qInteger
// ---------------------------------------------------------------------------

const IntegerFromString: Schema.Schema<number, string> = Schema.transformOrFail(
  Schema.String,
  Schema.Number,
  {
    strict: true,
    decode: (s, _options, ast) => {
      if (s === "" || !/^-?\d+$/.test(s)) {
        return Effect.fail(new ParseResult.Type(ast, s, "Expected an integer string"))
      }
      const n = Number(s)
      if (!Number.isFinite(n)) {
        return Effect.fail(new ParseResult.Type(ast, s, "Expected a finite integer"))
      }
      return Effect.succeed(n)
    },
    encode: (n, _options, ast) => {
      if (!Number.isInteger(n)) {
        return Effect.fail(new ParseResult.Type(ast, n, "Expected an integer"))
      }
      return Effect.succeed(String(n))
    },
  },
)

export const qInteger: QueryParser<number> = {
  schema: IntegerFromString,
}

// ---------------------------------------------------------------------------
// qFloat
// ---------------------------------------------------------------------------

const FloatFromString: Schema.Schema<number, string> = Schema.transformOrFail(
  Schema.String,
  Schema.Number,
  {
    strict: true,
    decode: (s, _options, ast) => {
      if (s === "") {
        return Effect.fail(new ParseResult.Type(ast, s, "Expected a numeric string"))
      }
      const n = Number(s)
      if (isNaN(n)) {
        return Effect.fail(new ParseResult.Type(ast, s, "Expected a numeric string"))
      }
      return Effect.succeed(n)
    },
    encode: (n) => Effect.succeed(String(n)),
  },
)

export const qFloat: QueryParser<number> = {
  schema: FloatFromString,
}

// ---------------------------------------------------------------------------
// qBoolean
// ---------------------------------------------------------------------------

const BooleanFromString: Schema.Schema<boolean, string> = Schema.transform(
  Schema.Literal("true", "false"),
  Schema.Boolean,
  {
    strict: true,
    decode: (s) => s === "true",
    encode: (b) => (b ? "true" as const : "false" as const),
  },
)

export const qBoolean: QueryParser<boolean> = {
  schema: BooleanFromString,
}

// ---------------------------------------------------------------------------
// qLiteral
// ---------------------------------------------------------------------------

export const qLiteral = <L extends string>(
  ...literals: readonly [L, ...Array<L>]
): QueryParser<L> => ({
  schema: Schema.Literal(...literals) as unknown as Schema.Schema<L, string>,
})

// ---------------------------------------------------------------------------
// qArray
// ---------------------------------------------------------------------------

export const qArray = <A>(item: QueryParser<A>): QueryParser<ReadonlyArray<A>> => {
  const decodeItem = Schema.decodeUnknownSync(item.schema)
  const encodeItem = Schema.encodeSync(item.schema)

  const ArrayFromString: Schema.Schema<ReadonlyArray<A>, string> = Schema.transformOrFail(
    Schema.String,
    Schema.Array(Schema.typeSchema(item.schema)) as Schema.Schema<ReadonlyArray<A>>,
    {
      strict: true,
      decode: (s, _options, ast) => {
        const parts = s.split(",")
        try {
          const result = parts.map((part) => decodeItem(part))
          return Effect.succeed(result)
        } catch {
          return Effect.fail(new ParseResult.Type(ast, s, "Failed to decode array element"))
        }
      },
      encode: (arr) => {
        const parts = arr.map((a) => encodeItem(a))
        return Effect.succeed(parts.join(","))
      },
    },
  )

  return { schema: ArrayFromString }
}

// ---------------------------------------------------------------------------
// qJson
// ---------------------------------------------------------------------------

export const qJson = <A, I>(
  targetSchema: Schema.Schema<A, I>,
): QueryParser<A> => {
  const decodeTarget = Schema.decodeUnknownSync(targetSchema)
  const encodeTarget = Schema.encodeSync(targetSchema)

  const JsonFromString: Schema.Schema<A, string> = Schema.transformOrFail(
    Schema.String,
    Schema.typeSchema(targetSchema) as Schema.Schema<A>,
    {
      strict: true,
      decode: (s, _options, ast) => {
        let parsed: unknown
        try {
          parsed = JSON.parse(s)
        } catch {
          return Effect.fail(new ParseResult.Type(ast, s, "Invalid JSON"))
        }
        try {
          const validated = decodeTarget(parsed)
          return Effect.succeed(validated)
        } catch {
          return Effect.fail(new ParseResult.Type(ast, s, "JSON does not match schema"))
        }
      },
      encode: (value) => {
        try {
          const encoded = encodeTarget(value)
          return Effect.succeed(JSON.stringify(encoded))
        } catch {
          return Effect.fail(
            new ParseResult.Type(
              Schema.String.ast,
              value,
              "Failed to encode to JSON",
            ),
          )
        }
      },
    },
  )

  return { schema: JsonFromString }
}

// ---------------------------------------------------------------------------
// withDefault
// ---------------------------------------------------------------------------

export const withDefault = <A>(
  parser: QueryParser<A>,
  defaultValue: A,
): QueryParser<A> & { readonly defaultValue: A } => ({
  ...parser,
  defaultValue,
})
