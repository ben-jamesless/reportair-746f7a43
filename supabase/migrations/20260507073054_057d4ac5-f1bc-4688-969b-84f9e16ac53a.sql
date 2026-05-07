create or replace function public.leave_project(_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  my_role project_role;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select role into my_role
    from public.project_members
   where project_id = _project_id and user_id = auth.uid();

  if my_role is null then
    raise exception 'You are not a member of this project';
  end if;

  if my_role = 'owner' then
    raise exception 'Owners cannot leave their own project. Transfer ownership or delete the project instead.';
  end if;

  delete from public.project_members
   where project_id = _project_id and user_id = auth.uid();
end;
$$;