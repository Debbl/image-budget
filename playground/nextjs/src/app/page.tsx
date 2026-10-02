import { Picker } from './picker'

// Compression is a browser job start to finish - there is no server half to
// this library, which is the point of putting it in a Next.js playground: the
// page is a server component and the work happens below it.
export default function Page() {
  return (
    <main>
      <h1>image-budget / Next.js</h1>
      <Picker />
    </main>
  )
}
