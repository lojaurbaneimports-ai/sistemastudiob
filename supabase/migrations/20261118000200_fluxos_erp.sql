-- Fluxos transacionais: evita venda/baixa parcial caso alguma etapa falhe.
create or replace function public.finalize_pdv_sale(
  p_cash_register_id uuid, p_customer_id uuid, p_subtotal numeric, p_discount numeric,
  p_total numeric, p_payment_method text, p_items jsonb
) returns uuid language plpgsql as $$
declare v_sale_id uuid; v_item jsonb; v_stock numeric; v_is_service boolean;
begin
  if not exists (select 1 from public.cash_registers where id = p_cash_register_id and status = 'open') then
    raise exception 'O caixa informado não está aberto';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'O carrinho está vazio'; end if;

  insert into public.sales (cash_register_id, customer_id, subtotal, discount, total, payment_method, status)
  values (p_cash_register_id, p_customer_id, p_subtotal, p_discount, p_total, p_payment_method, 'completed') returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select stock_qty, is_service into v_stock, v_is_service from public.products
      where id = (v_item->>'product_id')::uuid for update;
    if not found then raise exception 'Produto não encontrado'; end if;
    if not v_is_service and v_stock < (v_item->>'quantity')::numeric then
      raise exception 'Estoque insuficiente para o produto selecionado';
    end if;
    insert into public.sale_items (sale_id, product_id, description, quantity, unit_price, total)
    values (v_sale_id, (v_item->>'product_id')::uuid, v_item->>'description', (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric, (v_item->>'total')::numeric);
    if not v_is_service then
      update public.products set stock_qty = stock_qty - (v_item->>'quantity')::numeric where id = (v_item->>'product_id')::uuid;
      insert into public.stock_movements (product_id, type, quantity, reason, reference)
      values ((v_item->>'product_id')::uuid, 'out', (v_item->>'quantity')::numeric, 'Venda PDV', v_sale_id::text);
    end if;
  end loop;
  insert into public.cash_movements (cash_register_id, type, amount, description) values (p_cash_register_id, 'in', p_total, 'Venda PDV');
  insert into public.financial_transactions (type, description, category, contact_id, amount, issue_date, due_date, payment_date, payment_method, status)
  values ('income', 'Venda PDV', 'Vendas', p_customer_id, p_total, current_date, current_date, current_date, p_payment_method, 'paid');
  return v_sale_id;
end; $$;

create or replace function public.invoice_service_order(p_service_order_id uuid) returns uuid language plpgsql as $$
declare v_order public.service_orders%rowtype; v_financial_id uuid;
begin
  select * into v_order from public.service_orders where id = p_service_order_id for update;
  if not found then raise exception 'Ordem de serviço não encontrada'; end if;
  if v_order.status = 'delivered' then raise exception 'Esta OS já foi faturada'; end if;
  insert into public.financial_transactions (type, description, category, contact_id, amount, issue_date, due_date, status)
  values ('income', 'OS - ' || coalesce(v_order.equipment, 'Serviço'), 'Serviços', v_order.customer_id, v_order.total, current_date, current_date, 'pending') returning id into v_financial_id;
  update public.service_orders set status = 'delivered' where id = p_service_order_id;
  return v_financial_id;
end; $$;

grant execute on function public.finalize_pdv_sale(uuid,uuid,numeric,numeric,numeric,text,jsonb) to anon;
grant execute on function public.invoice_service_order(uuid) to anon;

create or replace function public.convert_quote_to_sale(p_quote_id uuid) returns uuid language plpgsql as $$
declare v_quote public.quotes%rowtype; v_item record; v_sale_id uuid; v_stock numeric; v_is_service boolean;
begin
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Orçamento não encontrado'; end if;
  if v_quote.status = 'rejected' then raise exception 'Não é possível converter um orçamento recusado'; end if;
  insert into public.sales (customer_id, subtotal, discount, total, payment_method, status)
  values (v_quote.customer_id, v_quote.subtotal, v_quote.discount, v_quote.total, 'pending', 'completed') returning id into v_sale_id;
  for v_item in select * from public.quote_items where quote_id = p_quote_id loop
    if v_item.product_id is not null then
      select stock_qty, is_service into v_stock, v_is_service from public.products where id = v_item.product_id for update;
      if not found then raise exception 'Produto do orçamento não encontrado'; end if;
      if not v_is_service and v_stock < v_item.quantity then raise exception 'Estoque insuficiente para conversão'; end if;
    else v_is_service := true; end if;
    insert into public.sale_items (sale_id, product_id, description, quantity, unit_price, total)
    values (v_sale_id, v_item.product_id, v_item.description, v_item.quantity, v_item.unit_price, v_item.total);
    if not v_is_service then
      update public.products set stock_qty = stock_qty - v_item.quantity where id = v_item.product_id;
      insert into public.stock_movements (product_id, type, quantity, reason, reference)
      values (v_item.product_id, 'out', v_item.quantity, 'Conversão de orçamento', p_quote_id::text);
    end if;
  end loop;
  insert into public.financial_transactions (type, description, category, contact_id, amount, issue_date, due_date, status)
  values ('income', 'Orçamento convertido em venda', 'Vendas', v_quote.customer_id, v_quote.total, current_date, current_date, 'pending');
  update public.quotes set status = 'approved' where id = p_quote_id;
  return v_sale_id;
end; $$;

create or replace function public.sync_service_order_part_stock() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.item_type = 'part' and new.product_id is not null then
    update public.products set stock_qty = stock_qty - new.quantity where id = new.product_id and is_service = false;
    insert into public.stock_movements (product_id, type, quantity, reason, reference)
    select new.product_id, 'out', new.quantity, 'Peça aplicada em OS', new.service_order_id::text
    where exists (select 1 from public.products where id = new.product_id and is_service = false);
  elsif tg_op = 'DELETE' and old.item_type = 'part' and old.product_id is not null then
    update public.products set stock_qty = stock_qty + old.quantity where id = old.product_id and is_service = false;
    insert into public.stock_movements (product_id, type, quantity, reason, reference)
    select old.product_id, 'in', old.quantity, 'Estorno de peça da OS', old.service_order_id::text
    where exists (select 1 from public.products where id = old.product_id and is_service = false);
  end if;
  return coalesce(new, old);
end; $$;

drop trigger if exists service_order_part_stock on public.service_order_items;
create trigger service_order_part_stock after insert or delete on public.service_order_items for each row execute function public.sync_service_order_part_stock();
grant execute on function public.convert_quote_to_sale(uuid) to anon;
