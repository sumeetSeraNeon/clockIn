-- Rename duplicate project names within each client so a unique
-- (client_id, name) index can be applied. First by created_at keeps
-- the original name; extras become "Name (2)", "Name (3)", …

WITH ranked AS (
  SELECT
    id,
    name,
    client_id,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, name
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM projects
)
UPDATE projects AS p
SET name = ranked.name || ' (' || ranked.rn || ')'
FROM ranked
WHERE p.id = ranked.id
  AND ranked.rn > 1;

WITH still_duped AS (
  SELECT
    id,
    name,
    client_id,
    ROW_NUMBER() OVER (
      PARTITION BY client_id, name
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM projects
)
UPDATE projects AS p
SET name = p.name || ' · ' || LEFT(REPLACE(p.id::text, '-', ''), 6)
FROM still_duped
WHERE p.id = still_duped.id
  AND still_duped.rn > 1;

CREATE UNIQUE INDEX "projects_client_id_name_key"
ON "projects"("client_id", "name");
