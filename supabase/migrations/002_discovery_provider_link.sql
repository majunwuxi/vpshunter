-- Link discovery leads to known providers when the author/name
-- matches an adapter alias.

alter table discovery_items
  add column provider_id uuid
    references providers(id)
    on delete set null;

create index discovery_items_provider_idx
  on discovery_items(provider_id);
