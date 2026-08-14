-- Enable Realtime for floor / KDS / POS sync
do $$
begin
  begin
    alter publication supabase_realtime add table public.restaurant_tables;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.orders;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.order_items;
  exception when duplicate_object then null;
  end;
end $$;
