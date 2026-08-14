import { create } from 'zustand'
import type { CartLineItem, PosState, SelectedModifier } from '@/types/interfaces'
import { OrderType } from '@/types/enums'

function lineUnitPrice(basePrice: number, modifiers: SelectedModifier[]): number {
  const deltas = modifiers.reduce((sum, modifier) => sum + Number(modifier.price_delta), 0)
  return Number(basePrice) + deltas
}

function modifiersKey(modifiers: SelectedModifier[]): string {
  return [...modifiers]
    .map((modifier) => modifier.id)
    .sort()
    .join(',')
}

function isSameCartLine(
  item: CartLineItem,
  input: {
    menu_item_id: string
    selected_modifiers: SelectedModifier[]
    notes?: string
  }
): boolean {
  if (item.menu_item_id !== input.menu_item_id) return false
  if ((item.notes ?? '') !== (input.notes ?? '')) return false
  return modifiersKey(item.selected_modifiers) === modifiersKey(input.selected_modifiers)
}

export function getCartSubtotal(items: CartLineItem[]): number {
  return items.reduce(
    (sum, item) => sum + item.unit_price * item.quantity,
    0
  )
}

export function getCartTaxTotal(
  items: CartLineItem[],
  discountTotal: number,
  taxRatePercent: number
): number {
  const taxable = Math.max(0, getCartSubtotal(items) - discountTotal)
  return Number(((taxable * Math.max(0, taxRatePercent)) / 100).toFixed(2))
}

export function getCartGrandTotal(
  items: CartLineItem[],
  discountTotal: number,
  taxRatePercent = 0
): number {
  const subtotalAfterDiscount = Math.max(0, getCartSubtotal(items) - discountTotal)
  const tax = getCartTaxTotal(items, discountTotal, taxRatePercent)
  return Number((subtotalAfterDiscount + tax).toFixed(2))
}

export const usePosStore = create<PosState>((set, get) => ({
  items: [],
  orderType: OrderType.DINE_IN,
  tableId: null,
  customerId: null,
  discountTotal: 0,
  notes: '',
  selectedLocalId: null,

  addItem: ({ menu_item_id, name, basePrice, selected_modifiers = [], notes }) => {
    const existing = get().items.find((item) =>
      isSameCartLine(item, { menu_item_id, selected_modifiers, notes })
    )

    if (existing) {
      set({
        items: get().items.map((item) =>
          item.localId === existing.localId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ),
        selectedLocalId: existing.localId,
      })
      return
    }

    const unit_price = lineUnitPrice(basePrice, selected_modifiers)
    const localId = crypto.randomUUID()

    set({
      items: [
        ...get().items,
        {
          localId,
          menu_item_id,
          name,
          quantity: 1,
          unit_price,
          selected_modifiers,
          notes,
        },
      ],
      selectedLocalId: localId,
    })
  },

  removeItem: (localId) => {
    const items = get().items.filter((item) => item.localId !== localId)
    set({
      items,
      selectedLocalId: get().selectedLocalId === localId ? null : get().selectedLocalId,
    })
  },

  setQuantity: (localId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(localId)
      return
    }
    set({
      items: get().items.map((item) =>
        item.localId === localId ? { ...item, quantity } : item
      ),
    })
  },

  setSelectedLocalId: (localId) => set({ selectedLocalId: localId }),
  setOrderType: (orderType) =>
    set({
      orderType,
      tableId: orderType === OrderType.DINE_IN ? get().tableId : null,
    }),
  setTableId: (tableId) => set({ tableId }),
  setCustomerId: (customerId) => set({ customerId }),
  setDiscountTotal: (amount) => set({ discountTotal: Math.max(0, amount) }),
  setNotes: (notes) => set({ notes }),
  clearCart: () =>
    set({
      items: [],
      discountTotal: 0,
      notes: '',
      selectedLocalId: null,
      tableId: null,
      customerId: null,
    }),
}))
