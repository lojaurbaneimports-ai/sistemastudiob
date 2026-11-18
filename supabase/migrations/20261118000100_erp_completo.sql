create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(), type text not null default 'customer' check (type in ('customer','supplier','both')),
  person_type text not null default 'PJ' check (person_type in ('PF','PJ')), name text not null, trade_name text,
  document text, email text, phone text, whatsapp text, zip_code text, street text, number text,
  complement text, neighborhood text, city text, state text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(), name text not null, role text, department text,
  daily_hours numeric(5,2) not null default 8, hourly_rate numeric(14,2) default 0, salary numeric(14,2) default 0,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.employees(id) on delete cascade,
  type text not null check (type in ('entry','lunch_out','lunch_return','exit')), entry_time timestamptz not null default now(),
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), sku text unique, name text not null, category text, unit text not null default 'UN',
  cost_price numeric(14,2) not null default 0, sale_price numeric(14,2) not null default 0,
  stock_qty numeric(14,3) not null default 0, min_stock numeric(14,3) not null default 0,
  is_service boolean not null default false, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete restrict,
  type text not null check (type in ('in','out','adjustment')), quantity numeric(14,3) not null, reason text, reference text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cash_registers (
  id uuid primary key default gen_random_uuid(), opening_balance numeric(14,2) not null default 0, closing_balance numeric(14,2),
  status text not null default 'open' check (status in ('open','closed')), opened_at timestamptz not null default now(), closed_at timestamptz, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(), cash_register_id uuid references public.cash_registers(id) on delete set null,
  customer_id uuid references public.contacts(id) on delete set null, subtotal numeric(14,2) not null default 0, discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0, payment_method text not null default 'cash', status text not null default 'completed', notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, description text, quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0, total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(), customer_id uuid references public.contacts(id) on delete set null,
  valid_until date, status text not null default 'pending' check (status in ('pending','sent','approved','rejected')),
  subtotal numeric(14,2) not null default 0, discount numeric(14,2) not null default 0, total numeric(14,2) not null default 0,
  payment_terms text, notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quotes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, description text not null, quantity numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0, total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(), customer_id uuid references public.contacts(id) on delete set null,
  equipment text, serial_number text, reported_issue text, technical_report text, technician text, delivery_deadline date,
  status text not null default 'open' check (status in ('open','in_analysis','awaiting_approval','in_progress','completed','delivered')),
  total numeric(14,2) not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.service_order_items (
  id uuid primary key default gen_random_uuid(), service_order_id uuid not null references public.service_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null, description text, item_type text not null default 'service' check (item_type in ('service','part')),
  quantity numeric(14,3) not null default 1, unit_price numeric(14,2) not null default 0, total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(), type text not null check (type in ('income','expense')), description text not null,
  category text, contact_id uuid references public.contacts(id) on delete set null, amount numeric(14,2) not null default 0,
  issue_date date not null default current_date, due_date date not null default current_date, payment_date date,
  payment_method text, status text not null default 'pending' check (status in ('pending','paid','overdue')),
  installments integer not null default 1, installment_number integer not null default 1, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(), cash_register_id uuid not null references public.cash_registers(id) on delete cascade,
  type text not null check (type in ('in','out')), amount numeric(14,2) not null, description text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- Compatibilidade com tabelas já existentes em projetos Lovable anteriores.
alter table public.employees add column if not exists position text;
alter table public.products add column if not exists active boolean not null default true;
alter table public.sales add column if not exists status text not null default 'completed';
alter table public.sales add column if not exists notes text;
alter table public.sale_items add column if not exists description text;
alter table public.financial_transactions add column if not exists notes text;
alter table public.cash_registers add column if not exists updated_at timestamptz not null default now();
alter table public.time_entries add column if not exists updated_at timestamptz not null default now();
alter table public.stock_movements add column if not exists updated_at timestamptz not null default now();
alter table public.sales add column if not exists updated_at timestamptz not null default now();
alter table public.sale_items add column if not exists created_at timestamptz not null default now();
alter table public.sale_items add column if not exists updated_at timestamptz not null default now();
alter table public.quote_items add column if not exists created_at timestamptz not null default now();
alter table public.quote_items add column if not exists updated_at timestamptz not null default now();
alter table public.service_order_items add column if not exists created_at timestamptz not null default now();
alter table public.service_order_items add column if not exists updated_at timestamptz not null default now();
alter table public.cash_movements add column if not exists updated_at timestamptz not null default now();

do $$ declare t text; begin
  foreach t in array array['contacts','employees','time_entries','products','stock_movements','cash_registers','sales','sale_items','quotes','quote_items','service_orders','service_order_items','financial_transactions','cash_movements'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists anon_full_access on public.%I', t);
    execute format('create policy anon_full_access on public.%I for all to anon using (true) with check (true)', t);
  end loop;
end $$;

create index if not exists idx_products_name on public.products(name);
create index if not exists idx_financial_due_date on public.financial_transactions(due_date);
create index if not exists idx_time_employee_date on public.time_entries(employee_id, entry_time);

insert into public.contacts (type,person_type,name,trade_name,document,email,phone,city,state)
select v.type,v.person_type,v.name,v.trade_name,v.document,v.email,v.phone,v.city,v.state from (values
('customer','PJ','Oficina Horizonte Ltda','Oficina Horizonte','12.345.678/0001-90','contato@oficinahorizonte.com.br','(11) 3456-7890','São Paulo','SP'),
('customer','PF','Mariana Costa',null,'123.456.789-09','mariana.costa@email.com','(11) 98888-1234','São Paulo','SP'),
('both','PJ','Construtora Vale Verde','Vale Verde','45.678.901/0001-23','compras@valeverde.com.br','(11) 3222-1100','Campinas','SP'),
('supplier','PJ','Distribuidora São Lucas','São Lucas','98.765.432/0001-10','vendas@saolucas.com.br','(11) 3111-2200','São Paulo','SP')) as v(type,person_type,name,trade_name,document,email,phone,city,state)
where not exists (select 1 from public.contacts c where c.document = v.document);
insert into public.employees (name,position,department,daily_hours,hourly_rate,salary,status)
select v.name,v.position,v.department,v.daily_hours,v.hourly_rate,v.salary,v.status from (values
('Carlos Eduardo Lima','Técnico de Manutenção','Operações',8,28,4800,'active'),
('Ana Paula Ribeiro','Assistente Financeiro','Administrativo',8,24,4100,'active'),
('João Martins','Vendedor','Comercial',8,22,3800,'active')) as v(name,position,department,daily_hours,hourly_rate,salary,status)
where not exists (select 1 from public.employees e where e.name = v.name);
insert into public.products (sku,name,category,unit,cost_price,sale_price,stock_qty,min_stock,is_service)
select v.sku,v.name,v.category,v.unit,v.cost_price,v.sale_price,v.stock_qty,v.min_stock,v.is_service
from (values
  ('P-001','Filtro de Óleo Premium','Peças','UN',24.50::numeric,49.90::numeric,4::numeric,8::numeric,false),
  ('P-002','Kit Correia Dentada','Peças','UN',185.00::numeric,329.90::numeric,12::numeric,3::numeric,false),
  ('P-003','Óleo Sintético 5W30','Lubrificantes','UN',32.00::numeric,64.90::numeric,28::numeric,10::numeric,false),
  ('S-001','Diagnóstico Técnico','Serviços','HR',0::numeric,150::numeric,0::numeric,0::numeric,true),
  ('S-002','Mão de Obra Especializada','Serviços','HR',0::numeric,120::numeric,0::numeric,0::numeric,true)
) as v(sku,name,category,unit,cost_price,sale_price,stock_qty,min_stock,is_service)
where not exists (select 1 from public.products p where p.sku = v.sku);

insert into public.financial_transactions (type,description,category,amount,issue_date,due_date,status,payment_method)
select 'income','Manutenção preventiva - Oficina Horizonte','Serviços',1250,current_date - interval '3 days',current_date - interval '3 days','paid','pix'
where not exists (select 1 from public.financial_transactions);
insert into public.financial_transactions (type,description,category,amount,issue_date,due_date,status,payment_method)
select 'income','Venda de peças - Mariana Costa','Vendas',489.70,current_date,current_date,'pending','card_credit'
where (select count(*) from public.financial_transactions) < 2;
insert into public.financial_transactions (type,description,category,amount,issue_date,due_date,status,payment_method)
select 'expense','Compra de insumos','Fornecedores',780.00,current_date - interval '2 days',current_date - interval '1 day','overdue','boleto'
where (select count(*) from public.financial_transactions) < 3;
insert into public.service_orders (customer_id,equipment,serial_number,reported_issue,technician,delivery_deadline,status,total)
select c.id,'Honda Civic 2020','ABC-1234','Ruído no motor e revisão geral','Carlos Eduardo Lima',current_date + 3,'in_progress',620
from public.contacts c where c.name = 'Mariana Costa' and not exists (select 1 from public.service_orders);
