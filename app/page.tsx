import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { error } = await supabase.auth.getSession()

  return <h1>{error ? 'Superbase error: ' + error.message : 'Supabase connected!'}</h1>
}