// POST /functions/v1/create-order
// Body: { items: [{ id, q }] }  ->  { order_id, amount, currency, key_id }
// The amount is calculated here from the real product prices, never taken from the browser.
import { basicAuth, cors, currentUser, json, razorpayKeys } from '../_shared/common.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const keys = razorpayKeys()
  if (!keys) return json({ error: 'Online payment is not configured' }, 500)

  const me = await currentUser(req)
  if (!me) return json({ error: 'Please log in again' }, 401)

  let body: { items?: { id?: unknown; q?: unknown }[] }
  try { body = await req.json() } catch { return json({ error: 'Invalid request' }, 400) }

  const items = Array.isArray(body.items) ? body.items : []
  if (!items.length || items.length > 50) return json({ error: 'Your cart is empty' }, 400)
  const lines = items.map((i) => ({ id: Number(i.id), q: Number(i.q) }))
  if (lines.some((l) => !Number.isInteger(l.id) || !Number.isInteger(l.q) || l.q < 1 || l.q > 20)) {
    return json({ error: 'Invalid item' }, 400)
  }

  const ids = [...new Set(lines.map((l) => l.id))]
  const { data: prods, error } = await me.sb
    .from('products')
    .select('id,name,price,delivery_fee,visible,in_stock,pay_online')
    .in('id', ids)
  if (error || !prods) return json({ error: 'Could not read the products' }, 500)

  let sub = 0
  let ship = 0
  const seen = new Set<number>()
  for (const l of lines) {
    const p = prods.find((x) => x.id === l.id)
    if (!p || !p.visible || !p.in_stock) return json({ error: 'Some items are unavailable' }, 400)
    if (!p.pay_online) return json({ error: `Online payment is not available for ${p.name}` }, 400)
    sub += Number(p.price) * l.q
    if (!seen.has(p.id)) { seen.add(p.id); ship += Number(p.delivery_fee || 0) } // delivery charge once per product
  }
  const total = sub + ship // same rule as the orders table trigger (no COD charge: this is online payment)
  const amount = Math.round(total * 100) // paise
  if (amount < 100) return json({ error: 'Minimum payment is ₹1' }, 400)

  const rz = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: basicAuth(keys.id, keys.secret), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      currency: 'INR',
      receipt: ('wk_' + me.user.id.slice(0, 8) + '_' + Date.now().toString(36)).slice(0, 40),
      notes: { user_id: me.user.id },
    }),
  })
  if (rz.status === 401) return json({ error: 'Razorpay authentication failed. Check the API keys.' }, 401)
  if (!rz.ok) return json({ error: 'Razorpay could not create the order' }, 500)
  const order = await rz.json()

  return json({ order_id: order.id, amount: order.amount, currency: order.currency, key_id: keys.id })
})
