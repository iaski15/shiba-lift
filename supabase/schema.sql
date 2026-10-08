-- Run once in Supabase dashboard -> SQL Editor.

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (char_length(username) between 2 and 24),
  created_at timestamptz default now()
);

-- Profile row is created automatically on sign-up from the username passed in metadata.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'shiba' || substr(new.id::text, 1, 6)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table follows (
  follower uuid references profiles on delete cascade default auth.uid(),
  followee uuid references profiles on delete cascade,
  primary key (follower, followee),
  check (follower <> followee)
);

create table posts (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles on delete cascade default auth.uid(),
  title text not null,
  summary jsonb not null,
  created_at timestamptz default now()
);
create index posts_user_created on posts (user_id, created_at desc);

create table likes (
  post_id bigint references posts on delete cascade,
  user_id uuid references profiles on delete cascade default auth.uid(),
  primary key (post_id, user_id)
);

create table comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references posts on delete cascade,
  user_id uuid not null references profiles on delete cascade default auth.uid(),
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz default now()
);

-- Explicit grants (projects can be set to not expose new tables to the API automatically). RLS below still decides which rows.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on profiles, follows, posts, likes, comments to authenticated;

alter table profiles enable row level security;
alter table follows enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;

-- Signed-in users can read everything; they can only write their own rows.
create policy "read" on profiles for select to authenticated using (true);
create policy "own" on profiles for update to authenticated using (id = auth.uid());

create policy "read" on follows for select to authenticated using (true);
create policy "own insert" on follows for insert to authenticated with check (follower = auth.uid());
create policy "own delete" on follows for delete to authenticated using (follower = auth.uid());

create policy "read" on posts for select to authenticated using (true);
create policy "own insert" on posts for insert to authenticated with check (user_id = auth.uid());
create policy "own delete" on posts for delete to authenticated using (user_id = auth.uid());

create policy "read" on likes for select to authenticated using (true);
create policy "own insert" on likes for insert to authenticated with check (user_id = auth.uid());
create policy "own delete" on likes for delete to authenticated using (user_id = auth.uid());

create policy "read" on comments for select to authenticated using (true);
create policy "own insert" on comments for insert to authenticated with check (user_id = auth.uid());
create policy "own delete" on comments for delete to authenticated using (user_id = auth.uid());
