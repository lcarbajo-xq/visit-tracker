import { Hono } from 'https://deno.land/x/hono@v3.11.9/mod.ts'
import { serveStatic } from 'https://deno.land/x/hono@v3.11.9/middleware.ts'
import { streamSSE } from 'https://deno.land/x/hono@v3.11.9/helper/streaming/index.ts'

interface Visit {
  city: string
  country: string
  flag: string
}

const db = await Deno.openKv()
const app = new Hono()
let i = 0

app.get('/', serveStatic({ path: './index.html' }))
app.post('/counter', async (c) => {
  await db.atomic().sum(['visits'], 1n).commit()
  return c.json({ message: 'ok' })
})

app.post('/visit', async (c) => {
  const { country, city, flag } = await c.req.json<Visit>()
  await db
    .atomic()
    .set(['lastVisit'], { country, flag, city })
    .sum(['visits'], 1n)
    .commit()
  return c.json({ message: 'ok' })
})

app.get('/visit', (c) => {
  return streamSSE(c, async (stream) => {
    const key = ['lastVisit']
    const listOfKeys = [key]
    const watcher = db.watch(listOfKeys)

    for await (const event of watcher) {
      const { value } = event[0]

      if (value != null) {
        await stream.writeSSE({
          data: JSON.stringify(value),
          event: 'update',
          id: String(i++)
        })
      }
    }

    // while (true) {
    //   const { value } = await db.get<Deno.KvU64>(['visits'])
    //   await stream.writeSSE({
    //     data: Number(value).toString(),
    //     event: 'update',
    //     id: String(i++)
    //   })
    //   await stream.sleep(1000)
    // }
  })
})

app.get('/counter', (c) => {
  return streamSSE(c, async (stream) => {
    const key = ['visits']
    const listOfKeys = [key]
    const watcher = db.watch(listOfKeys)

    for await (const event of watcher) {
      const { value } = event[0]

      if (value != null) {
        await stream.writeSSE({
          data: value.toString(),
          event: 'update',
          id: String(i++)
        })
      }
    }

    // while (true) {
    //   const { value } = await db.get<Deno.KvU64>(['visits'])
    //   await stream.writeSSE({
    //     data: Number(value).toString(),
    //     event: 'update',
    //     id: String(i++)
    //   })
    //   await stream.sleep(1000)
    // }
  })
})

Deno.serve(app.fetch)
