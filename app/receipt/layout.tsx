import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Receipt',
}

export default function ReceiptLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
