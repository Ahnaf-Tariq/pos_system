'use client'

import * as React from 'react'
import { Modal } from 'antd'
import { cn } from '@/lib/utils'

interface DialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function Dialog({
  open = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <DialogContext.Provider
      value={{
        open: Boolean(open),
        onOpenChange: onOpenChange ?? (() => undefined),
      }}
    >
      {children}
    </DialogContext.Provider>
  )
}

function DialogTrigger({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function DialogClose({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = React.useContext(DialogContext)
  return (
    <button
      type="button"
      {...props}
      onClick={(event) => {
        props.onClick?.(event)
        ctx?.onOpenChange(false)
      }}
    >
      {children}
    </button>
  )
}

function resolveModalWidth(className?: string) {
  if (!className) return 520
  if (className.includes('max-w-2xl')) return 672
  if (className.includes('max-w-xl')) return 576
  if (className.includes('max-w-lg')) return 512
  if (className.includes('max-w-md')) return 448
  if (className.includes('max-w-sm')) return 384
  return 520
}

function DialogContent({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  const ctx = React.useContext(DialogContext)
  if (!ctx) return null

  const scrollable = Boolean(className?.includes('overflow-y'))
  const hasMaxHeight = Boolean(className?.includes('max-h'))

  return (
    <Modal
      open={ctx.open}
      onCancel={() => ctx.onOpenChange(false)}
      footer={null}
      centered
      destroyOnHidden
      width={resolveModalWidth(className)}
      className={cn('app-dialog-modal', className)}
      styles={{
        body: {
          maxHeight: hasMaxHeight ? '90vh' : undefined,
          overflowY: scrollable ? 'auto' : hasMaxHeight ? 'hidden' : undefined,
          paddingTop: 4,
          display: hasMaxHeight ? 'flex' : undefined,
          flexDirection: hasMaxHeight ? 'column' : undefined,
        },
      }}
    >
      <div
        className={cn(
          hasMaxHeight ? 'flex min-h-0 flex-1 flex-col gap-4' : 'grid gap-4'
        )}
      >
        {children}
      </div>
    </Modal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 text-left', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return (
    <h2
      className={cn('text-lg font-semibold leading-none tracking-tight text-foreground', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
}
