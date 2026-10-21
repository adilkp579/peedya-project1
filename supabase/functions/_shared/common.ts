// Shared helpers for the Razorpay edge functions.
// Secrets are read from environment variables only (see supabase/functions/.env.example).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

// Set ALLOWED_ORIGIN (for example https://peedya.in) in the function secrets to accept calls only from your site.
export const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

export const razorpayKeys = () => {
  const id = Deno.env.get('RAZORPAY_KEY_ID') || ''
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET') || ''
  return id && secret ? { id, secret } : null
}

export const basicAuth = (id: string, secret: string) => 'Basic ' + btoa(id + ':' + secret)

// The signed-in customer, or null. Uses the Authorization header the browser sends.
export async function currentUser(req: Request) {
  const auth = req.headers.get('Authorization') || ''
  if (!auth) return null
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data, error } = await sb.auth.getUser()
  if (error || !data.user) return null
  return { user: data.user, sb }
}

export const serviceClient = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// HMAC-SHA256 as lowercase hex
export async function hmacHex(message: string, secret: string) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// constant-time string compare
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
