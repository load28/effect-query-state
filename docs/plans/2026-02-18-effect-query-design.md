# Effect-Query Design Document

> Effect-TS 기반 타입 안전 URL Query Parameter 관리 라이브러리

## 개요

nuqs 스타일의 query parameter 핸들링을 Effect-TS로 구현한다. 코어는 프레임워크 종속성 없이 순수 Effect로 작성하고, React 바인딩을 별도 레이어로 제공한다.

## 기술 스택

- **Runtime**: bun
- **Language**: TypeScript (strict)
- **Core**: Effect-TS (Schema, Service, Layer, Tagged Error)
- **Test**: Vitest + @testing-library/react
- **Build**: tsup
- **방법론**: TDD (Red → Green → Refactor)

## 스코프

### 포함

- 기본 파서: string, integer, float, boolean
- 고급 파서: literal, array, json
- withDefault 유틸리티
- 단일 파라미터 관리 (useQueryState)
- 다중 파라미터 관리 (useQueryStates)
- createSerializer 유틸리티
- clearOnDefault, history push/replace 옵션

### 제외 (v1 범위 밖)

- throttle/debounce
- SSR/Server Component 지원
- shallow routing (Next.js 전용)
- 프레임워크별 어댑터 (Remix, React Router 등)

## 패키지 구조

```
effect-query/
├── src/
│   ├── core/                    # 프레임워크 종속성 없음 (순수 Effect)
│   │   ├── parsers.ts           # Schema 기반 파서 팩토리
│   │   ├── params.ts            # QueryParam 읽기/쓰기 오퍼레이션
│   │   ├── serializer.ts        # createSerializer 유틸
│   │   ├── errors.ts            # Tagged Errors
│   │   ├── adapter.ts           # URLAdapter Service 인터페이스
│   │   └── index.ts
│   ├── react/                   # React 바인딩
│   │   ├── adapter.ts           # BrowserURLAdapter Layer
│   │   ├── provider.tsx         # QueryProvider (Runtime 주입)
│   │   ├── useQueryState.ts     # 단일 파라미터 hook
│   │   ├── useQueryStates.ts    # 다중 파라미터 hook
│   │   └── index.ts
│   └── index.ts
├── test/
│   ├── core/
│   │   ├── parsers.test.ts
│   │   ├── params.test.ts
│   │   └── serializer.test.ts
│   └── react/
│       ├── useQueryState.test.tsx
│       └── useQueryStates.test.tsx
```

### 경계 원칙

- `core/` → Effect만 의존. 브라우저/Node/Deno 어디서든 동작
- `react/` → `core/` + React에 의존. Layer를 통해 실제 URL 어댑터 주입
- 테스트에서는 `MockURLAdapter`를 Layer로 주입하여 브라우저 없이 테스트

## Core 설계

### Tagged Errors

```typescript
import { Data } from "effect"

class ParseError extends Data.TaggedError("ParseError")<{
  readonly key: string
  readonly value: string
  readonly message: string
}> {}

class SerializeError extends Data.TaggedError("SerializeError")<{
  readonly key: string
  readonly value: unknown
  readonly message: string
}> {}

class AdapterError extends Data.TaggedError("AdapterError")<{
  readonly operation: "get" | "set"
  readonly message: string
}> {}
```

### Schema 기반 Parser

Parser = Schema. `Schema.transform(String, Target)` 으로 URL string ↔ 값 양방향 변환.

```typescript
interface QueryParser<A> {
  readonly schema: Schema.Schema<A, string>
  readonly defaultValue?: A
}
```

내장 파서:
- `qString` - 문자열 (패스스루)
- `qInteger` - 정수 (parseInt, Schema.Int 검증)
- `qFloat` - 실수 (parseFloat)
- `qBoolean` - 불린 ("true"/"false")
- `qLiteral(...literals)` - 리터럴 유니온
- `qArray(parser)` - 쉼표 구분 배열
- `qJson(schema)` - JSON + Schema 검증
- `withDefault(parser, default)` - 기본값 부여

### URLAdapter Service

코어가 브라우저에 종속되지 않기 위한 DI 인터페이스.

```typescript
interface URLAdapter {
  readonly getSearchParams: Effect.Effect<URLSearchParams, AdapterError>
  readonly setSearchParams: (
    params: URLSearchParams,
    options: { history: "push" | "replace" }
  ) => Effect.Effect<void, AdapterError>
  readonly subscribe: (
    listener: () => void
  ) => Effect.Effect<() => void, AdapterError>
}

const URLAdapter = Context.GenericTag<URLAdapter>("@effect-query/URLAdapter")
```

### 코어 오퍼레이션

- `getParam(key, parser)` - 단일 파라미터 읽기. URLAdapter에서 읽고 Schema decode.
- `setParam(key, parser, value, options)` - 단일 파라미터 쓰기. Schema encode 후 URLAdapter에 반영. clearOnDefault 지원.
- `getParams(parsers)` - 다중 파라미터 일괄 읽기.
- `setParams(parsers, values, options)` - 다중 파라미터 배치 쓰기. URL 한 번만 갱신.

## React 바인딩

### QueryProvider

`ManagedRuntime`으로 Effect Runtime을 React Context에 주입. 기본값은 `BrowserURLAdapterLayer`, 테스트 시 `MockURLAdapterLayer` 교체.

### useQueryState(key, parser)

- `[value, setValue]` 튜플 반환
- 초기 로드 시 URL에서 읽기
- popstate 구독으로 뒤로가기/앞으로가기 반영
- 낙관적 업데이트: setState 먼저 → URL 반영 → 에러 시 Tagged Error 핸들링

### useQueryStates(parsers)

- `[values, setValues]` 반환
- 다중 파라미터 일괄 읽기
- 부분 업데이트: 변경된 것만 넘기면 나머지 유지
- 배치 처리: URL 한 번만 갱신

### createSerializer(parsers)

- `(base, values) => Effect<string, SerializeError>`
- Link 컴포넌트나 외부에서 URL 생성용
- 기본값은 URL에서 생략

## TDD 구현 순서

```
Phase 1: parsers.test.ts  → errors.ts + parsers.ts
Phase 2: params.test.ts   → adapter.ts + params.ts
Phase 3: serializer.test.ts → serializer.ts
Phase 4: useQueryState.test.tsx → provider.tsx + adapter.ts(browser) + useQueryState.ts
Phase 5: useQueryStates.test.tsx → useQueryStates.ts
```

각 Phase에서 Red → Green → Refactor 사이클을 반복한다.
