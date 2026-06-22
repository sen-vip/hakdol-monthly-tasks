-- 학돌 월별필수업무 Supabase schema
-- Supabase SQL Editor에서 실행하세요.
-- 이번 버전: 업무 체크 상태 + 우리 학교 업무 + 학교 설정 + 직접 추가 일정 계정 저장

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

create table if not exists public.user_school_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  office_code text,
  office_name text,
  school_code text,
  school_name text,
  school_level text,
  school_address text,
  updated_at timestamptz not null default now()
);

create unique index if not exists user_school_settings_user_id_key
  on public.user_school_settings(user_id);

create table if not exists public.user_manual_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  title text not null,
  memo text default '',
  source text default '직접추가',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_manual_events_user_date
  on public.user_manual_events(user_id, date);

alter table public.user_task_states enable row level security;
alter table public.custom_tasks enable row level security;
alter table public.user_school_settings enable row level security;
alter table public.user_manual_events enable row level security;

-- 기존 정책명이 있으면 다시 실행해도 충돌하지 않도록 삭제 후 생성합니다.
drop policy if exists "user_task_states_select_own" on public.user_task_states;
drop policy if exists "user_task_states_insert_own" on public.user_task_states;
drop policy if exists "user_task_states_update_own" on public.user_task_states;
drop policy if exists "user_task_states_delete_own" on public.user_task_states;

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

drop policy if exists "custom_tasks_select_own" on public.custom_tasks;
drop policy if exists "custom_tasks_insert_own" on public.custom_tasks;
drop policy if exists "custom_tasks_update_own" on public.custom_tasks;
drop policy if exists "custom_tasks_delete_own" on public.custom_tasks;

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

drop policy if exists "user_school_settings_select_own" on public.user_school_settings;
drop policy if exists "user_school_settings_insert_own" on public.user_school_settings;
drop policy if exists "user_school_settings_update_own" on public.user_school_settings;
drop policy if exists "user_school_settings_delete_own" on public.user_school_settings;

create policy "user_school_settings_select_own"
  on public.user_school_settings for select
  using (auth.uid() = user_id);

create policy "user_school_settings_insert_own"
  on public.user_school_settings for insert
  with check (auth.uid() = user_id);

create policy "user_school_settings_update_own"
  on public.user_school_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_school_settings_delete_own"
  on public.user_school_settings for delete
  using (auth.uid() = user_id);

drop policy if exists "user_manual_events_select_own" on public.user_manual_events;
drop policy if exists "user_manual_events_insert_own" on public.user_manual_events;
drop policy if exists "user_manual_events_update_own" on public.user_manual_events;
drop policy if exists "user_manual_events_delete_own" on public.user_manual_events;

create policy "user_manual_events_select_own"
  on public.user_manual_events for select
  using (auth.uid() = user_id);

create policy "user_manual_events_insert_own"
  on public.user_manual_events for insert
  with check (auth.uid() = user_id);

create policy "user_manual_events_update_own"
  on public.user_manual_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_manual_events_delete_own"
  on public.user_manual_events for delete
  using (auth.uid() = user_id);

create index if not exists idx_user_task_states_user_id on public.user_task_states(user_id);
create index if not exists idx_custom_tasks_user_month on public.custom_tasks(user_id, month);
