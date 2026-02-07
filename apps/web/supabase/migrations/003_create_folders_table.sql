-- Create folders table
create table if not exists public.folders (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    color text default '#3B82F6',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.folders enable row level security;

-- Policies
drop policy if exists "Users can view own folders" on public.folders;
create policy "Users can view own folders"
    on public.folders for select
    using (auth.uid() = user_id);

drop policy if exists "Users can create own folders" on public.folders;
create policy "Users can create own folders"
    on public.folders for insert
    with check (auth.uid() = user_id);

drop policy if exists "Users can update own folders" on public.folders;
create policy "Users can update own folders"
    on public.folders for update
    using (auth.uid() = user_id);

drop policy if exists "Users can delete own folders" on public.folders;
create policy "Users can delete own folders"
    on public.folders for delete
    using (auth.uid() = user_id);

-- Add index
create index if not exists folders_user_id_idx on public.folders(user_id);
-- Check if files table exists, if not create it (Safety check)
create table if not exists public.files (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    folder_id text, -- Can be uuid or 'root' string, keeping flexible
    name text not null,
    storage_path text not null,
    content_type text,
    size integer,
    created_at timestamp with time zone default now()
);
-- Add RLS for files if newly created
alter table public.files enable row level security;
drop policy if exists "Users can view own files" on public.files;
create policy "Users can view own files" on public.files for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own files" on public.files;
create policy "Users can insert own files" on public.files for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own files" on public.files;
create policy "Users can update own files" on public.files for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own files" on public.files;
create policy "Users can delete own files" on public.files for delete using (auth.uid() = user_id);
