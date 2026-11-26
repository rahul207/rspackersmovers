-- Proposed PostgreSQL schema (not applied by this version). Review before use.

create table consent_records (
  consent_id uuid primary key,
  created_at timestamptz not null,
  visitor_id uuid,
  purpose text not null check (purpose in ('COOKIE_PREFERENCES', 'QUOTATION', 'CONTACT')),
  consent_version text not null,
  privacy_notice_version text not null,
  necessary boolean not null default true,
  analytics boolean not null default false,
  marketing boolean not null default false,
  location boolean not null default false
);
create index consent_records_visitor_idx on consent_records (visitor_id);
create index consent_records_created_idx on consent_records (created_at);

create table quote_requests (
  reference_number text primary key check (reference_number ~ '^RSPM-[0-9]{8}-[A-Z0-9]{4}$'),
  created_at timestamptz not null,
  customer_name text not null,
  mobile text not null check (mobile ~ '^91[6-9][0-9]{9}$'),
  email text,
  pickup_address text not null,
  pickup_latitude numeric(9, 6) not null,
  pickup_longitude numeric(9, 6) not null,
  drop_address text not null,
  drop_latitude numeric(9, 6) not null,
  drop_longitude numeric(9, 6) not null,
  distance_km numeric(8, 1) not null,
  move_type text not null,
  vehicle_type text not null,
  pickup_date date not null,
  estimate_total numeric(12, 2),
  estimate jsonb not null,
  notes text,
  consent_id uuid not null references consent_records (consent_id),
  status text not null default 'NEW' check (status in ('NEW', 'CONTACTED', 'CONFIRMED', 'CANCELLED', 'CLOSED')),
  source_page text not null default '/'
);
create index quote_requests_created_idx on quote_requests (created_at);
create index quote_requests_status_idx on quote_requests (status);
create index quote_requests_mobile_idx on quote_requests (mobile);

create table contact_requests (
  request_id text primary key check (request_id ~ '^RSPM-C-[0-9]{8}-[A-Z0-9]{4}$'),
  created_at timestamptz not null,
  name text not null,
  mobile text not null check (mobile ~ '^91[6-9][0-9]{9}$'),
  email text,
  subject text not null,
  message text not null,
  preferred_contact_method text not null check (preferred_contact_method in ('PHONE_CALL', 'WHATSAPP', 'EMAIL')),
  consent_id uuid not null references consent_records (consent_id),
  status text not null default 'NEW' check (status in ('NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM')),
  source_page text not null default '/'
);
create index contact_requests_created_idx on contact_requests (created_at);

create table visitors (
  visitor_id uuid primary key,
  first_visit timestamptz not null,
  last_visit timestamptz not null,
  landing_page text not null,
  referral_category text not null,
  campaign_source text,
  campaign_medium text,
  campaign_name text,
  device_category text not null,
  browser_family text not null,
  os_family text not null,
  language text,
  region text,
  consent_status text not null
);
create index visitors_last_visit_idx on visitors (last_visit);
