'use client'

import { useEffect, useRef } from 'react'
import { Printer } from 'lucide-react'
import type { ThermalReceiptData } from '@/types/interfaces'
import { formatDateTime, formatMoney } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const THERMAL_WIDTH_MM = 58

interface ThermalReceiptPrintProps {
  data: ThermalReceiptData
  autoprint?: boolean
}

export function ThermalReceiptPrint({
  data,
  autoprint = false,
}: ThermalReceiptPrintProps) {
  const didAutoprintRef = useRef(false)
  const {
    order,
    shopName,
    currency,
    taxRatePercent,
    receiptLogoUrl,
    receiptFooter,
    customerName,
    customerPhone,
    tableLabel,
    items,
  } = data

  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    root.classList.add('thermal-print-root')
    body.classList.add('thermal-print-root')
    return () => {
      root.classList.remove('thermal-print-root')
      body.classList.remove('thermal-print-root')
    }
  }, [])

  useEffect(() => {
    if (!autoprint || didAutoprintRef.current) return
    didAutoprintRef.current = true
    const timer = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(timer)
  }, [autoprint])

  const w = `${THERMAL_WIDTH_MM}mm`
  const orderRef = order.id.slice(0, 8).toUpperCase()
  const issuedAt = formatDateTime(order.closed_at ?? order.created_at)

  return (
    <>
      <style>{`
        html.thermal-print-root,
        body.thermal-print-root {
          margin: 0;
          padding: 0;
          min-height: 100vh;
          background: #d4d4d4;
        }
        body.thermal-print-root {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 12px 0 24px;
        }
        @page {
          margin: 0;
        }
        .no-print { display: block; }
        @media print {
          html.thermal-print-root,
          body.thermal-print-root {
            display: block !important;
            width: 100% !important;
            min-width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            min-height: 0 !important;
            height: auto !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print { display: none !important; }
          body.thermal-print-root * { visibility: hidden; }
          body.thermal-print-root .thermal-receipt-sheet,
          body.thermal-print-root .thermal-receipt-sheet * {
            visibility: visible;
          }
          .thermal-receipt-sheet {
            position: absolute !important;
            left: 50% !important;
            top: 0 !important;
            transform: translateX(-50%) !important;
            width: ${w} !important;
            max-width: ${w} !important;
            margin: 0 !important;
            padding: 2mm !important;
            box-shadow: none !important;
            font-family: Arial, Helvetica, sans-serif !important;
          }
        }
      `}</style>

      <div className="no-print fixed right-2 top-2 z-50">
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" />
          Print
        </Button>
      </div>

      <p
        className="no-print mx-auto px-2 text-center text-[11px] leading-snug text-neutral-600"
        style={{ maxWidth: w }}
      >
        Thermal receipt ({THERMAL_WIDTH_MM}mm). Use Print for your printer or Save as PDF.
      </p>

      <div
        className="thermal-receipt-sheet"
        style={{
          width: w,
          maxWidth: w,
          margin: '0 auto',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '8pt',
          lineHeight: 1.35,
          color: '#000',
          padding: '2mm',
          background: '#fff',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
        }}
      >
        {receiptLogoUrl ? (
          <div style={{ textAlign: 'center', marginBottom: '2mm' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptLogoUrl}
              alt=""
              style={{
                maxWidth: '36mm',
                maxHeight: '18mm',
                objectFit: 'contain',
                margin: '0 auto',
              }}
            />
          </div>
        ) : null}

        <div style={{ textAlign: 'center', marginBottom: '2mm' }}>
          <div
            style={{
              fontSize: '11pt',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            {shopName}
          </div>
        </div>

        <Divider />

        <div style={{ textAlign: 'center', marginBottom: '1.5mm' }}>
          <div style={{ fontSize: '9pt', fontWeight: 'bold' }}>RECEIPT</div>
          <div style={{ fontSize: '7pt' }}>#{orderRef}</div>
        </div>

        <Row label="Date" value={issuedAt} />
        <Row
          label="Type"
          value={order.order_type.replaceAll('_', ' ').toUpperCase()}
        />
        {tableLabel ? <Row label="Table" value={tableLabel} /> : null}
        {order.payment_method ? (
          <Row
            label="Paid by"
            value={order.payment_method.replaceAll('_', ' ').toUpperCase()}
          />
        ) : null}

        <Divider />

        {(customerName || customerPhone) && (
          <>
            <div
              style={{
                fontSize: '7pt',
                fontWeight: 'bold',
                marginBottom: '0.5mm',
              }}
            >
              BILL TO:
            </div>
            {customerName ? (
              <div style={{ fontSize: '7.5pt', fontWeight: 'bold' }}>
                {customerName}
              </div>
            ) : null}
            {customerPhone ? (
              <div style={{ fontSize: '7pt' }}>Ph: {customerPhone}</div>
            ) : null}
            <Divider />
          </>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '7pt',
            fontWeight: 'bold',
            borderBottom: '1px solid #000',
            paddingBottom: '0.5mm',
            marginBottom: '1mm',
          }}
        >
          <span style={{ flex: 1 }}>ITEM</span>
          <span style={{ width: '22mm', textAlign: 'right' }}>QTY × PRICE</span>
          <span style={{ width: '14mm', textAlign: 'right' }}>AMT</span>
        </div>

        {items.map((item, index) => (
          <div key={`${item.name}-${index}`} style={{ marginBottom: '1.5mm' }}>
            <div
              style={{
                fontSize: '7.5pt',
                fontWeight: 'bold',
                wordBreak: 'break-word',
              }}
            >
              {item.name}
            </div>
            {item.modifiers.length > 0 ? (
              <div style={{ fontSize: '7pt', color: '#555' }}>
                {item.modifiers.map((modifier) => modifier.name).join(', ')}
              </div>
            ) : null}
            {item.notes ? (
              <div style={{ fontSize: '7pt', color: '#555' }}>
                Note: {item.notes}
              </div>
            ) : null}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '7pt',
              }}
            >
              <span />
              <span style={{ width: '22mm', textAlign: 'right' }}>
                {item.quantity} × {formatMoney(item.unit_price, currency)}
              </span>
              <span style={{ width: '14mm', textAlign: 'right' }}>
                {formatMoney(item.amount, currency)}
              </span>
            </div>
          </div>
        ))}

        <Divider />

        <Row label="Subtotal" value={formatMoney(order.subtotal, currency)} />
        {order.discount_total > 0 ? (
          <Row
            label="Discount"
            value={`- ${formatMoney(order.discount_total, currency)}`}
          />
        ) : null}
        {order.tax_total > 0 ? (
          <Row
            label={`Tax (${taxRatePercent}%)`}
            value={formatMoney(order.tax_total, currency)}
          />
        ) : null}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontWeight: 'bold',
            fontSize: '9pt',
            borderTop: '1px solid #000',
            marginTop: '1mm',
            paddingTop: '1mm',
          }}
        >
          <span>TOTAL</span>
          <span>{formatMoney(order.grand_total, currency)}</span>
        </div>

        <Divider />

        <div style={{ textAlign: 'center', fontSize: '7pt', marginTop: '1mm' }}>
          {receiptFooter?.trim() || 'Thank you for your business!'}
        </div>
        <div
          style={{
            textAlign: 'center',
            fontSize: '6.5pt',
            color: '#666',
            marginTop: '1mm',
          }}
        >
          {shopName}
        </div>
      </div>
    </>
  )
}

function Divider() {
  return (
    <div
      style={{
        borderTop: '1px dashed #888',
        margin: '1.5mm 0',
      }}
    />
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '7.5pt',
        marginBottom: '0.5mm',
      }}
    >
      <span>{label}:</span>
      <span style={{ fontWeight: 'bold' }}>{value}</span>
    </div>
  )
}
