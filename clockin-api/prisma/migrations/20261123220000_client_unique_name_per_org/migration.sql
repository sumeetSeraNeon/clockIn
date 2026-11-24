-- Rename duplicate client names within each organisation so a unique
-- (organisation_id, name) index can be applied. First by created_at keeps
-- the original name; extras become "Name (2)", "Name (3)", …

WITH ranked AS (
  SELECT
    id,
    name,
    organisation_id,
    ROW_NUMBER() OVER (
      PARTITION BY organisation_id, name
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM clients
)
UPDATE clients AS c
SET name = ranked.name || ' (' || ranked.rn || ')'
FROM ranked
WHERE c.id = ranked.id
  AND ranked.rn > 1;

-- Ensure renamed names do not collide with an existing "Name (2)" etc.
-- Second pass: if any remaining duplicates (e.g. both "Acme" and "Acme (2)"
-- already existed), append a short id suffix until unique within the org.
WITH still_duped AS (
  SELECT
    id,
    name,
    organisation_id,
    ROW_NUMBER() OVER (
      PARTITION BY organisation_id, name
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM clients
)
UPDATE clients AS c
SET name = c.name || ' · ' || LEFT(REPLACE(c.id::text, '-', ''), 6)
FROM still_duped
WHERE c.id = still_duped.id
  AND still_duped.rn > 1;

CREATE UNIQUE INDEX "clients_organisation_id_name_key"
ON "clients"("organisation_id", "name");
