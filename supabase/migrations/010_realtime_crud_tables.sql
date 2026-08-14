-- Enable Realtime for CRUD screens that auto-refresh without a Refresh button
do $$
begin
  begin
    alter publication supabase_realtime add table public.staff_members;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.customers;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.inventory_items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.inventory_movements;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.menu_items;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.categories;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.locations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.modifiers;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.modifier_groups;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.recipe_items;
  exception when duplicate_object then null;
  end;
end $$;
