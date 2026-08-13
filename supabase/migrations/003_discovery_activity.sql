-- Source-side activity timestamp for discovery leads
-- (e.g. Vanilla forum LastCommentDate). Used to filter recent leads.

alter table discovery_items
  add column source_activity_at timestamptz;

create index discovery_items_activity_idx
  on discovery_items(source_activity_at);
