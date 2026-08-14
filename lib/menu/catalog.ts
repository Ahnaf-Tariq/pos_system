import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Category,
  MenuItem,
  MenuItemWithGroups,
  Modifier,
  ModifierGroup,
  ModifierGroupWithOptions,
} from '@/types/interfaces'

export async function fetchMenuCatalog(supabase: SupabaseClient, userId: string) {
  const [{ data: categories, error: categoriesError }, { data: items, error: itemsError }] =
    await Promise.all([
      supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('menu_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ])

  if (categoriesError) throw new Error(categoriesError.message)
  if (itemsError) throw new Error(itemsError.message)

  const menuItems = (items as MenuItem[]) ?? []
  const itemIds = menuItems.map((item) => item.id)

  let groups: ModifierGroup[] = []
  let modifiers: Modifier[] = []

  if (itemIds.length > 0) {
    const { data: groupRows, error: groupsError } = await supabase
      .from('modifier_groups')
      .select('*')
      .eq('user_id', userId)
      .in('menu_item_id', itemIds)
      .order('name', { ascending: true })

    if (groupsError) throw new Error(groupsError.message)
    groups = (groupRows as ModifierGroup[]) ?? []

    const groupIds = groups.map((group) => group.id)
    if (groupIds.length > 0) {
      const { data: modifierRows, error: modifiersError } = await supabase
        .from('modifiers')
        .select('*')
        .eq('user_id', userId)
        .in('modifier_group_id', groupIds)
        .order('name', { ascending: true })

      if (modifiersError) throw new Error(modifiersError.message)
      modifiers = (modifierRows as Modifier[]) ?? []
    }
  }

  const itemsWithGroups: MenuItemWithGroups[] = menuItems.map((item) => {
    const itemGroups = groups
      .filter((group) => group.menu_item_id === item.id)
      .map((group) => ({
        ...group,
        modifiers: modifiers.filter((modifier) => modifier.modifier_group_id === group.id),
      }))

    return {
      ...item,
      price: Number(item.price),
      modifier_groups: itemGroups,
    }
  })

  return {
    categories: (categories as Category[]) ?? [],
    items: itemsWithGroups,
  }
}

export async function uploadMenuImage({
  supabase,
  userId,
  file,
}: {
  supabase: SupabaseClient
  userId: string
  file: File
}) {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${crypto.randomUUID()}.${extension}`

  const { error } = await supabase.storage.from('menu-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from('menu-images').getPublicUrl(path)
  return data.publicUrl
}
