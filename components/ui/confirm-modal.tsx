"use client";

import { Modal } from "antd";
import type { ReactNode } from "react";

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmLoading?: boolean;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmLoading = false,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      okText={confirmText}
      cancelText={cancelText}
      confirmLoading={confirmLoading}
      okButtonProps={{ danger }}
      onOk={onConfirm}
      onCancel={onCancel}
      centered
      destroyOnHidden
    >
      {description ? (
        <div className="text-sm text-muted-foreground">{description}</div>
      ) : null}
    </Modal>
  );
}
