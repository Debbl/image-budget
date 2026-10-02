# image-budget

> Replace me: one sentence, the same one in `package.json`'s `description` and
> on the docs site's landing page.

## Install

```bash
pnpm add image-budget
```

## Usage

```tsx
'use client'
import { createStore } from 'image-budget/core'
import { useStore } from 'image-budget'

const counter = createStore(0)

export function Counter() {
  const count = useStore(counter)
  return <button onClick={() => counter.set((n) => n + 1)}>{count}</button>
}
```

## Entry points

| subpath             | contents                                                   |
| ------------------- | ---------------------------------------------------------- |
| `image-budget`      | the React binding - carries `'use client'`                 |
| `image-budget/core` | framework-agnostic, safe in a server component or a worker |
| `image-budget/next` | Next.js: read a persisted value on the server              |

The split is the point: `.` is a client module, so anything a server component
has to call lives in `./core`. Re-exporting `createStore` from `.` would turn
it into a client reference and break the server call site.

## API

### `createStore<T>(initial)`

Returns `{ getSnapshot, set, subscribe }`. `set` takes a value or an updater,
and is a no-op when the result is `Object.is`-equal to the current one.

### `useStore(store)`

`useSyncExternalStore` over the above. Same snapshot on server and client.

### `readCookie(name)` (`image-budget/next`)

Reads a cookie from a server component, route handler or server action.

## License

MIT © [Brendan Dash](https://aiwan.run)
