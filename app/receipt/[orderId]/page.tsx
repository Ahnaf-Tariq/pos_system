import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardSession } from '@/lib/auth/session'
import { fetchThermalReceiptData } from '@/lib/receipts/fetch-receipt'
import { ThermalReceiptPrint } from '@/components/receipts/thermal-receipt-print'
import { ROUTES } from '@/lib/routes'

export const metadata: Metadata = {
  title: 'Thermal receipt',
}

export default async function ThermalReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>
  searchParams: Promise<{ print?: string }>
}) {
  const { orderId } = await params
  const query = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(ROUTES.login)

  const session = await getDashboardSession(supabase, user.id)
  if (!session) redirect(ROUTES.pendingApproval)

  const data = await fetchThermalReceiptData(
    supabase,
    orderId,
    session.shop.user_id
  )

  if (!data) notFound()

  return (
    <ThermalReceiptPrint data={data} autoprint={query.print === '1'} />
  )
}
