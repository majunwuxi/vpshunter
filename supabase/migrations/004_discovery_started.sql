-- Thread creation time for discovery leads (Vanilla JSON-LD dateCreated).
-- Distinct from source_activity_at (last comment) and used for strict
-- "posted within N hours" filtering.

alter table discovery_items
  add column source_started_at timestamptz;

create index discovery_items_started_idx
  on discovery_items(source_started_at);
