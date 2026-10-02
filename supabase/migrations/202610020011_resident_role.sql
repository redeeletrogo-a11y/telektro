-- Separate migration: a new enum value cannot be used in the same transaction that adds it.
alter type public.organization_role add value if not exists 'resident';
