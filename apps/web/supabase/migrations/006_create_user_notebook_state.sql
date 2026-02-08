-- Persist notebook state (tabs + deep history + highlights) per user for cross-device sync
create table if not exists public.user_notebook_state (
    user_id uuid primary key references auth.users(id) on delete cascade,
    payload jsonb not null default '{}',
    updated_at timestamp with time zone default now()
);

alter table public.user_notebook_state enable row level security;

drop policy if exists "Users can view own notebook state" on public.user_notebook_state;
create policy "Users can view own notebook state"
    on public.user_notebook_state for select
    using (auth.uid() = user_id);

drop policy if exists "Users can insert own notebook state" on public.user_notebook_state;
create policy "Users can insert own notebook state"
    on public.user_notebook_state for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own notebook state" on public.user_notebook_state;
create policy "Users can update own notebook state"
    on public.user_notebook_state for update
    using (auth.uid() = user_id);

drop policy if exists "Users can delete own notebook state" on public.user_notebook_state;
create policy "Users can delete own notebook state"
    on public.user_notebook_state for delete
    using (auth.uid() = user_id);

create index if not exists user_notebook_state_updated_at_idx on public.user_notebook_state(updated_at);
