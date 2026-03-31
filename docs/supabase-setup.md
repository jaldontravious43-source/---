# Supabase 配置（手机号 OTP + 排行榜）

以下 SQL 请在 Supabase 的 **SQL Editor** 中执行。

## 1. 创建/更新表结构

```sql
create extension if not exists pgcrypto;

create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  player_name text not null check (char_length(player_name) between 1 and 12),
  score int not null check (score >= 0),
  duration_seconds int not null check (duration_seconds > 0),
  captured_husband_count int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.game_scores
add column if not exists user_id uuid references auth.users(id) on delete cascade;

create table if not exists public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 2. 启用 RLS 与策略

```sql
alter table public.game_scores enable row level security;
alter table public.player_profiles enable row level security;

-- 全服排行榜可读
 drop policy if exists "score read all" on public.game_scores;
create policy "score read all"
on public.game_scores
for select
to anon, authenticated
using (true);

-- 成绩写入：必须是登录用户，并且 user_id = auth.uid()
drop policy if exists "score insert own user" on public.game_scores;
create policy "score insert own user"
on public.game_scores
for insert
to authenticated
with check (auth.uid() = user_id);

-- 昵称读取：仅本人
drop policy if exists "profile read own" on public.player_profiles;
create policy "profile read own"
on public.player_profiles
for select
to authenticated
using (auth.uid() = id);

-- 昵称写入/更新：仅本人
drop policy if exists "profile upsert own" on public.player_profiles;
create policy "profile upsert own"
on public.player_profiles
for all
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);
```

## 3. Supabase Auth 设置（手机号验证码）

在 Supabase 控制台：

1. 进入 `Authentication` -> `Providers`。
2. 启用 `Phone`。
3. 按 Supabase 指引配置短信服务（生产环境必须配置真实短信渠道）。

## 4. 前端配置说明

本项目 `src/main-standalone.js` 已内置以下配置：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

如果你后续更换 Supabase 项目，更新该文件中的配置即可。

## 5. 验证清单

1. 未登录时“开始游戏/再来一局/战绩查询”按钮不可用。
2. 手机号 + 验证码登录后可开始游戏。
3. 首次登录强制设置昵称（1-12 字符）。
4. 提交分数后 `game_scores.user_id` 正确写入当前账号。
5. “战绩查询”可显示全服 Top15（含游戏时间）。
