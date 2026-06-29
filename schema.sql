-- =====================================================
-- JAYASOORIYA DISTRIBUTORS — Database Migrations & Schema
-- Run the appropriate section in the Supabase SQL Editor.
-- Project: hyberxnmbluynnuibxuq.supabase.co
-- =====================================================

-- ─────────────────────────────────────────────────────
-- OPTION A: ALTER EXISTING TABLES (No Data Loss)
-- Run this if you already created tables previously and want to keep your data.
-- ─────────────────────────────────────────────────────
alter table products add column if not exists cost_price numeric(12, 2) default 0;
alter table products add column if not exists selling_price numeric(12, 2) default 0;
alter table products drop column if exists unit_price;
alter table products drop column if exists stock_qty;

alter table bills add column if not exists subtotal_amount numeric(12, 2) default 0;
alter table bills add column if not exists discount_percentage numeric(5, 2) default 0;
alter table bills add column if not exists payment_type text not null default 'cash' check (payment_type in ('cash', 'cheque'));
alter table bills add column if not exists status text not null default 'unpaid' check (status in ('paid', 'unpaid'));

alter table bill_items add column if not exists cost_price numeric(12, 2) not null default 0;


-- ─────────────────────────────────────────────────────
-- OPTION B: RESET AND RECREATE ALL TABLES (Deletes All Data)
-- Run this if you want a clean start. It will delete all tables and recreate them.
-- ─────────────────────────────────────────────────────
/*
drop table if exists bill_items cascade;
drop table if exists bills cascade;
drop table if exists products cascade;
drop table if exists outlets cascade;
drop table if exists given_cheques cascade;
drop table if exists received_cheques cascade;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- TABLE: outlets
create table outlets (
    id          uuid primary key default uuid_generate_v4(),
    name        text not null,
    address     text,
    created_at  timestamptz default now()
);
alter table outlets enable row level security;
drop policy if exists "outlets_all" on outlets;
create policy "outlets_all" on outlets for all using (auth.role() = 'authenticated');

-- TABLE: products (tyres)
create table products (
    id             uuid primary key default uuid_generate_v4(),
    brand          text not null,
    size           text not null,
    type           text,
    pattern        text,
    cost_price     numeric(12, 2) default 0,
    selling_price  numeric(12, 2) default 0,
    created_at     timestamptz default now()
);
alter table products enable row level security;
drop policy if exists "products_all" on products;
create policy "products_all" on products for all using (auth.role() = 'authenticated');

-- TABLE: bills
create table bills (
    id                   uuid primary key default uuid_generate_v4(),
    bill_number          text,
    outlet_id            uuid references outlets(id) on delete set null,
    bill_date            date not null,
    subtotal_amount      numeric(12, 2) default 0,
    discount_percentage  numeric(5, 2) default 0,
    total_amount         numeric(12, 2) default 0,
    payment_type         text not null default 'cash' check (payment_type in ('cash', 'cheque')),
    status               text not null default 'unpaid' check (status in ('paid', 'unpaid')),
    notes                text,
    created_at           timestamptz default now()
);
alter table bills enable row level security;
drop policy if exists "bills_all" on bills;
create policy "bills_all" on bills for all using (auth.role() = 'authenticated');

-- TABLE: bill_items
create table bill_items (
    id          uuid primary key default uuid_generate_v4(),
    bill_id     uuid references bills(id) on delete cascade,
    product_id  uuid references products(id) on delete set null,
    qty         integer not null default 1,
    cost_price  numeric(12, 2) not null default 0,
    unit_price  numeric(12, 2) not null default 0,
    line_total  numeric(12, 2) not null default 0,
    created_at  timestamptz default now()
);
alter table bill_items enable row level security;
drop policy if exists "bill_items_all" on bill_items;
create policy "bill_items_all" on bill_items for all using (auth.role() = 'authenticated');

-- TABLE: given_cheques
create table given_cheques (
    id             uuid primary key default uuid_generate_v4(),
    bank_name      text not null,
    cheque_number  text not null,
    amount         numeric(12, 2) not null default 0,
    cheque_date    date not null,
    payee          text,
    status         text not null default 'pending' check (status in ('pending', 'cleared', 'bounced', 'cancelled')),
    notes          text,
    created_at     timestamptz default now()
);
alter table given_cheques enable row level security;
drop policy if exists "given_cheques_all" on given_cheques;
create policy "given_cheques_all" on given_cheques for all using (auth.role() = 'authenticated');

-- TABLE: received_cheques
create table received_cheques (
    id              uuid primary key default uuid_generate_v4(),
    bank_name       text not null,
    cheque_number   text not null,
    amount          numeric(12, 2) not null default 0,
    drawer          text not null,
    outlet_id       uuid references outlets(id) on delete set null,
    received_date   date not null,
    realizing_date  date not null,
    status          text not null default 'pending' check (status in ('pending', 'cleared', 'bounced')),
    notes           text,
    created_at      timestamptz default now()
);
alter table received_cheques enable row level security;
drop policy if exists "received_cheques_all" on received_cheques;
create policy "received_cheques_all" on received_cheques for all using (auth.role() = 'authenticated');

-- INDEXES
create index if not exists idx_bills_outlet_id     on bills(outlet_id);
create index if not exists idx_bills_bill_date     on bills(bill_date desc);
create index if not exists idx_bill_items_bill_id  on bill_items(bill_id);
create index if not exists idx_given_cheques_status on given_cheques(status);
create index if not exists idx_received_cheques_realizing on received_cheques(realizing_date asc);
create index if not exists idx_received_cheques_status    on received_cheques(status);
*/
