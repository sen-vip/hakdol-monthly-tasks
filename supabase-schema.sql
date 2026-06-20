-- 학돌 월별필수업무 v1.0 Supabase schema
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.user_task_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id text not null,
  done boolean not null default false,
  important boolean not null default false,
  skipped boolean not null default false,
  memo text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

create table if not exists public.custom_tasks (
  custom_task_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  period text default '',
  category text not null default '내 업무',
  title text not null,
  description text default '',
  memo text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_task_states enable row level security;
alter table public.custom_tasks enable row level security;

create policy "user_task_states_select_own"
  on public.user_task_states for select
  using (auth.uid() = user_id);

create policy "user_task_states_insert_own"
  on public.user_task_states for insert
  with check (auth.uid() = user_id);

create policy "user_task_states_update_own"
  on public.user_task_states for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_task_states_delete_own"
  on public.user_task_states for delete
  using (auth.uid() = user_id);

create policy "custom_tasks_select_own"
  on public.custom_tasks for select
  using (auth.uid() = user_id);

create policy "custom_tasks_insert_own"
  on public.custom_tasks for insert
  with check (auth.uid() = user_id);

create policy "custom_tasks_update_own"
  on public.custom_tasks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "custom_tasks_delete_own"
  on public.custom_tasks for delete
  using (auth.uid() = user_id);

create index if not exists idx_user_task_states_user_id on public.user_task_states(user_id);
create index if not exists idx_custom_tasks_user_month on public.custom_tasks(user_id, month);
