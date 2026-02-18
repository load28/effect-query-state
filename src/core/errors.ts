import { Data } from "effect"

export class ParseError extends Data.TaggedError("ParseError")<{
  readonly key: string
  readonly value: string
  readonly message: string
}> {}

export class SerializeError extends Data.TaggedError("SerializeError")<{
  readonly key: string
  readonly value: unknown
  readonly message: string
}> {}

export class AdapterError extends Data.TaggedError("AdapterError")<{
  readonly operation: "get" | "set"
  readonly message: string
}> {}
