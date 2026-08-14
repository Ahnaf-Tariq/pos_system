'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Modal, Input } from 'antd'

export interface PromptModalProps {
  open: boolean
  title: string
  description?: ReactNode
  defaultValue?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
  confirmLoading?: boolean
  required?: boolean
  onConfirm: (value: string) => void | Promise<void>
  onCancel: () => void
}

export function PromptModal({
  open,
  title,
  description,
  defaultValue = '',
  placeholder,
  confirmText = 'Save',
  cancelText = 'Cancel',
  confirmLoading = false,
  required = true,
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    if (open) setValue(defaultValue)
  }, [open, defaultValue])

  async function handleOk() {
    const trimmed = value.trim()
    if (required && !trimmed) return
    await onConfirm(trimmed)
  }

  return (
    <Modal
      open={open}
      title={title}
      okText={confirmText}
      cancelText={cancelText}
      confirmLoading={confirmLoading}
      onOk={() => void handleOk()}
      onCancel={onCancel}
      centered
      destroyOnHidden
      okButtonProps={{ disabled: required && !value.trim() }}
    >
      {description ? (
        <p className="mb-3 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <Input
        autoFocus
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onPressEnter={() => void handleOk()}
      />
    </Modal>
  )
}
