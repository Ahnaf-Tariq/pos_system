import type { SupabaseClient } from '@supabase/supabase-js'
import { detectIntent, type DataSource } from './intents'
import { extractParams } from './extractor'
import { fetchData } from './fetcher'
import { buildResponse } from './responder'

interface ProcessMessageInput {
    message: string
    source: DataSource
    userId: string
    locationId: string | null
    currency: string
    supabase: SupabaseClient
}

export async function processMessage({
    message,
    source,
    userId,
    locationId,
    currency,
    supabase,
}: ProcessMessageInput): Promise<{ reply: string }> {
    const intent = detectIntent(message, source)
    const params = extractParams(message)
    const data = await fetchData(supabase, userId, locationId, intent, params, source)
    const reply = buildResponse(data, params, currency)
    return { reply }
}