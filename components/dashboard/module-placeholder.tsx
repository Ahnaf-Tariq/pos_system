import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Module',
}

export function ModulePlaceholder({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 rounded-lg border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">
        This module shell is ready. Feature UI lands in the next build steps.
      </div>
    </div>
  )
}
