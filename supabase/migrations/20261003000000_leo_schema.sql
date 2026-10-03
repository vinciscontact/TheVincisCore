-- ==========================================================================
-- Leo — TheVincis back office: clients, projects, services, quotes, invoices
-- Single-admin app. Every table is locked behind RLS: only a user listed in
-- public.admins, signed in with MFA (aal2), can read or write anything.
-- ==========================================================================

-- ---------- Admin gate ----------
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- No policies on admins: the table is managed from the SQL editor only.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
     and coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Shared updated_at trigger
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Settings (single row) ----------
create table public.settings (
  id                   int primary key default 1 check (id = 1),
  company_name         text not null default 'TheVincis',
  tagline              text default 'Digital craftsmanship that wins hearts.',
  address              text default '',
  state                text default 'Tamil Nadu',
  phone                text default '',
  email                text default 'vincis.contact@gmail.com',
  website              text default 'vincisglobal.com',
  -- GST: off until registered; documents still work without a GSTIN
  gst_enabled          boolean not null default false,
  gstin                text default '',
  gst_rate             numeric(5,2) not null default 18,
  -- Payment details (left blank on purpose — fill in from Leo → Settings)
  bank_name            text default '',
  account_name         text default '',
  account_number       text default '',
  ifsc                 text default '',
  upi_id               text default '',
  -- Numbering + defaults
  quote_prefix         text not null default 'TV-Q',
  invoice_prefix       text not null default 'TV-INV',
  quote_validity_days  int  not null default 15,
  payment_terms_days   int  not null default 7,
  quote_terms          text default E'50% advance to begin work, balance on delivery.\nQuote valid for the period shown above.\nScope changes after approval are quoted separately.',
  invoice_terms        text default E'Payment due by the date shown above.\nPlease quote the invoice number with your payment.',
  updated_at           timestamptz not null default now()
);
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------- Clients ----------
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  company     text default '',
  email       text default '',
  phone       text default '',
  address     text default '',
  city        text default '',
  state       text default '',
  gstin       text default '',
  notes       text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger clients_touch before update on public.clients
  for each row execute function public.touch_updated_at();

-- ---------- Services catalog ----------
create table public.services (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text default '',
  sac          text default '',
  unit         text not null default 'project',
  price        numeric(12,2) not null default 0 check (price >= 0),
  active       boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger services_touch before update on public.services
  for each row execute function public.touch_updated_at();

-- ---------- Projects ----------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  title       text not null,
  type        text not null default 'Website',
  status      text not null default 'lead'
              check (status in ('lead','quoted','active','delivered','closed')),
  start_date  date,
  due_date    date,
  value       numeric(12,2) not null default 0 check (value >= 0),
  notes       text default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index projects_client_idx on public.projects (client_id);
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- ---------- Documents (quotations + invoices) ----------
create table public.documents (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null check (kind in ('quote','invoice')),
  number           text not null unique,
  client_id        uuid not null references public.clients (id) on delete restrict,
  project_id       uuid references public.projects (id) on delete set null,
  source_quote_id  uuid references public.documents (id) on delete set null,
  issue_date       date not null default (now() at time zone 'Asia/Kolkata')::date,
  due_date         date,                  -- quote: valid until · invoice: due by
  status           text not null,
  items            jsonb not null default '[]'::jsonb,
  discount         numeric(12,2) not null default 0 check (discount >= 0),
  gst_enabled      boolean not null default false,
  gst_rate         numeric(5,2) not null default 0,
  interstate       boolean not null default false,
  subtotal         numeric(12,2) not null default 0,
  tax_total        numeric(12,2) not null default 0,
  total            numeric(12,2) not null default 0,
  bill_to          jsonb not null default '{}'::jsonb,   -- client snapshot at issue
  notes            text default '',
  terms            text default '',
  paid_on          date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint documents_status_ck check (
    (kind = 'quote'   and status in ('draft','sent','accepted','declined')) or
    (kind = 'invoice' and status in ('unpaid','paid'))
  )
);
create index documents_client_idx  on public.documents (client_id);
create index documents_project_idx on public.documents (project_id);
create index documents_source_idx  on public.documents (source_quote_id);
create index documents_kind_idx    on public.documents (kind, issue_date desc);
create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();

-- ---------- Numbering: PREFIX-FY-NNN, restarts every April ----------
create table public.counters (
  kind  text not null check (kind in ('quote','invoice')),
  fy    int  not null,
  last  int  not null default 0,
  primary key (kind, fy)
);

create or replace function public.next_doc_number(p_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today  date := (now() at time zone 'Asia/Kolkata')::date;
  v_fy     int  := case when extract(month from v_today) >= 4
                        then extract(year from v_today)::int
                        else extract(year from v_today)::int - 1 end;
  v_n      int;
  v_prefix text;
begin
  if not public.is_admin() then
    raise exception 'not authorised';
  end if;
  if p_kind not in ('quote','invoice') then
    raise exception 'bad kind %', p_kind;
  end if;

  insert into public.counters as c (kind, fy, last) values (p_kind, v_fy, 1)
  on conflict (kind, fy) do update set last = c.last + 1
  returning c.last into v_n;

  select case when p_kind = 'quote' then s.quote_prefix else s.invoice_prefix end
    into v_prefix from public.settings s where s.id = 1;

  return coalesce(v_prefix, upper(p_kind)) || '-' || v_fy || '-' || lpad(v_n::text, 3, '0');
end;
$$;
revoke all on function public.next_doc_number(text) from public, anon;
grant execute on function public.next_doc_number(text) to authenticated;

-- ---------- RLS: admin-only everywhere ----------
do $$
declare t text;
begin
  foreach t in array array['settings','clients','services','projects','documents','counters'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format(
      'create policy "admin full access" on public.%I for all to authenticated
         using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;
revoke all on public.admins from anon, authenticated;
