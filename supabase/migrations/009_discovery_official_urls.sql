-- Official / product URLs extracted from discovery thread bodies.
-- Used to verify a discovered provider on their own site.

alter table discovery_items
  add column official_urls jsonb;

create index discovery_items_official_idx
  on discovery_items((official_urls IS NOT NULL));
