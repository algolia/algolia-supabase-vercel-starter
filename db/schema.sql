create table if not exists products (
  id integer primary key,
  name text not null,
  description text not null,
  category text not null,
  price numeric(10,2) not null,
  image_url text,
  rating numeric(2,1),
  cost_price numeric(10,2),
  supplier_id text,
  internal_notes text,
  stock_location text,
  updated_at timestamptz not null default now()
);
