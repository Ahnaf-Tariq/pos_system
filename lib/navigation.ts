import {
  BarChart3,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  MonitorSmartphone,
  Package,
  Settings,
  ShoppingBag,
  Users,
  UserRound,
} from 'lucide-react'
import { ROUTES, type AppRoute } from '@/lib/routes'
import { StaffRole } from '@/types/enums'
import type { NavItem } from '@/types/interfaces'

const ALL_ROLES: StaffRole[] = [
  StaffRole.OWNER,
  StaffRole.MANAGER,
  StaffRole.CASHIER,
  StaffRole.WAITER,
  StaffRole.KITCHEN,
]

export const NAV_ITEMS: NavItem[] = [
  {
    title: 'Dashboard',
    href: ROUTES.dashboard,
    icon: LayoutDashboard,
    roles: [StaffRole.OWNER, StaffRole.MANAGER],
  },
  {
    title: 'POS',
    href: ROUTES.pos,
    icon: MonitorSmartphone,
    roles: [StaffRole.OWNER, StaffRole.MANAGER, StaffRole.CASHIER, StaffRole.WAITER],
  },
  {
    title: 'Tables',
    href: ROUTES.tables,
    icon: LayoutGrid,
    roles: [StaffRole.OWNER, StaffRole.MANAGER, StaffRole.WAITER],
  },
  {
    title: 'KDS',
    href: ROUTES.kds,
    icon: ChefHat,
    roles: [StaffRole.OWNER, StaffRole.MANAGER, StaffRole.KITCHEN],
  },
  {
    title: 'Menu',
    href: ROUTES.menu,
    icon: ClipboardList,
    roles: [StaffRole.OWNER, StaffRole.MANAGER],
  },
  {
    title: 'Inventory',
    href: ROUTES.inventory,
    icon: Package,
    roles: [StaffRole.OWNER, StaffRole.MANAGER],
  },
  {
    title: 'Orders',
    href: ROUTES.orders,
    icon: ShoppingBag,
    roles: [StaffRole.OWNER, StaffRole.MANAGER, StaffRole.CASHIER, StaffRole.WAITER],
  },
  {
    title: 'Reports',
    href: ROUTES.reports,
    icon: BarChart3,
    roles: [StaffRole.OWNER, StaffRole.MANAGER],
  },
  {
    title: 'Staff',
    href: ROUTES.staff,
    icon: Users,
    roles: [StaffRole.OWNER, StaffRole.MANAGER],
  },
  {
    title: 'Customers',
    href: ROUTES.customers,
    icon: UserRound,
    roles: [StaffRole.OWNER, StaffRole.MANAGER],
  },
  {
    title: 'Settings',
    href: ROUTES.settings,
    icon: Settings,
    roles: [StaffRole.OWNER, StaffRole.MANAGER],
  },
]

export function getNavItemsForRole(role: StaffRole | null | undefined): NavItem[] {
  if (!role) return NAV_ITEMS.filter((item) => item.roles.includes(StaffRole.OWNER))
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}

export function getDefaultRouteForRole(role: StaffRole | null | undefined): AppRoute {
  if (role === StaffRole.KITCHEN) return ROUTES.kds
  if (role === StaffRole.CASHIER) return ROUTES.pos
  if (role === StaffRole.WAITER) return ROUTES.tables
  return ROUTES.dashboard
}

export function roleLabel(role: StaffRole | string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export { ALL_ROLES }
