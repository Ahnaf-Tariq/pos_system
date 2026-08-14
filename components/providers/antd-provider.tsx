'use client'

import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider, theme } from 'antd'

export function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <ConfigProvider
        theme={{
          algorithm: theme.darkAlgorithm,
          token: {
            colorPrimary: '#2ef2c5',
            colorInfo: '#2ef2c5',
            colorBgBase: '#0a0a0b',
            colorBgContainer: '#141416',
            colorBgElevated: '#141416',
            colorBorder: '#27272a',
            colorText: '#f4f4f5',
            colorTextSecondary: '#a1a1aa',
            borderRadius: 8,
            fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
          },
        }}
      >
        {children}
      </ConfigProvider>
    </AntdRegistry>
  )
}
