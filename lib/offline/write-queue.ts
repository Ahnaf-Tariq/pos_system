import { enqueueWrite } from '@/lib/offline/db'
import { WriteQueueType, type WriteQueueTypeValue } from '@/types/interfaces'

export async function queueWrite({
  type,
  payload,
  clientGeneratedId,
}: {
  type: WriteQueueTypeValue
  payload: unknown
  clientGeneratedId?: string
}) {
  const id = clientGeneratedId ?? crypto.randomUUID()
  await enqueueWrite({
    client_generated_id: id,
    type,
    payload,
  })
  return id
}

export { WriteQueueType }
