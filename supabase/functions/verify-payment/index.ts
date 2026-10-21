// POST /functions/v1/verify-payment
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Checks HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET) against the signature.
// Only a matching signature is recorded in the `payments` table; the orders trigger then
// accepts that payment once, for the same customer and the same amount.
import { basicAuth, cors, currentUser, hmacHex, json, razorpayKeys, safeEqual, serviceClient } from '../_shared/common.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const keys = razorpayKeys()
  if (!keys) return json({ error: 'Online payment is not configured' }, 500)

  const me = await currentUser(req)
  if (!me) return json({ error: 'Please log in again' }, 401)

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return json({ error: 'Invalid request' }, 400) }
  const orderId = String(b.razorpay_order_id || '')
  const paymentId = String(b.razorpay_payment_id || '')
  const signature = String(b.razorpay_signature || '')
  if (!orderId || !paymentId || !signature) return json({ error: 'Missing payment details' }, 400)

  const expected = await hmacHex(orderId + '|' + paymentId, keys.secret)
  if (!safeEqual(expected, signature.toLowerCase())) {
    return json({ success: false, error: 'Payment signature does not match' }, 400) // never mark as paid
  }

  // The order must be one this customer created (set in create-order notes) and gives the paid amount.
  const rz = await fetch('https://api.razorpay.com/v1/orders/' + encodeURIComponent(orderId), {
    headers: { Authorization: basicAuth(keys.id, keys.secret) },
  })
  if (rz.status === 401) return json({ error: 'Razorpay authentication failed. Check the API keys.' }, 401)
  if (!rz.ok) return json({ error: 'Could not confirm the payment with Razorpay' }, 500)
  const order = await rz.json()
  if (order.notes?.user_id !== me.user.id) return json({ success: false, error: 'This payment belongs to another account' }, 400)

  const db = serviceClient()
  const { error } = await db.from('payments').insert({
    razorpay_payment_id: paymentId,
    razorpay_order_id: orderId,
    user_id: me.user.id,
    amount_paise: order.amount,
  })
  if (error && error.code !== '23505') return json({ error: 'Could not save the payment' }, 500) // 23505 = already saved

  return json({ success: true, payment_id: paymentId })
})
