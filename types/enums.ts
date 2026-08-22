export enum AccountStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  SUSPENDED = "SUSPENDED",
}

export enum StaffRole {
  OWNER = "owner",
  MANAGER = "manager",
  CASHIER = "cashier",
  WAITER = "waiter",
  KITCHEN = "kitchen",
}

export enum OrderType {
  DINE_IN = "dine_in",
  TAKEAWAY = "takeaway",
  DELIVERY = "delivery",
}

export enum OrderStatus {
  OPEN = "open",
  SENT_TO_KITCHEN = "sent_to_kitchen",
  READY = "ready",
  SERVED = "served",
  PAID = "paid",
  VOID = "void",
}

export enum BusinessType {
  RESTAURANT = "restaurant",
  RETAIL = "retail",
}

export enum TableStatus {
  AVAILABLE = "available",
  OCCUPIED = "occupied",
  RESERVED = "reserved",
  DIRTY = "dirty",
}

export enum KdsStatus {
  PENDING = "pending",
  PREPARING = "preparing",
  READY = "ready",
  SERVED = "served",
}

export enum InventoryMovementReason {
  SALE = "sale",
  RESTOCK = "restock",
  WASTE = "waste",
  ADJUSTMENT = "adjustment",
}

export enum PaymentMethod {
  CASH = "cash",
  CARD = "card",
}

export enum SubscriptionPlan {
  STARTER = "starter",
  GROWTH = "growth",
  PRO = "pro",
}

export enum SalaryPayBasis {
  MONTHLY = "monthly",
  DAILY = "daily",
}

export enum AttendanceStatus {
  PRESENT = "present",
  ABSENT = "absent",
  LEAVE = "leave",
  HALF_DAY = "half_day",
}

export enum CashSessionStatus {
  OPEN = "open",
  CLOSED = "closed",
}

export enum CashMovementType {
  CASH_IN = "cash_in",
  CASH_OUT = "cash_out",
}
