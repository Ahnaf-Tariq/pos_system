import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDashboardSession } from '@/lib/auth/session'
import { processMessage } from '@/lib/chatbot'
import type { DataSource } from '@/lib/chatbot/intents'

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()

        const {
            data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const session = await getDashboardSession(supabase, user.id)
        if (!session) {
            return NextResponse.json({ error: 'No session' }, { status: 403 })
        }

        const body = (await req.json()) as {
            message: string
            source: DataSource
            locationId?: string | null
        }

        const { message, source, locationId = null } = body

        if (!message?.trim()) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 })
        }

        const { reply } = await processMessage({
            message,
            source,
            userId: session.shop.user_id,
            locationId,
            currency: session.shop.currency,
            supabase,
        })

        return NextResponse.json({ reply })
    } catch (err) {
        console.error('[chatbot]', err)
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Something went wrong' },
            { status: 500 },
        )
    }
}