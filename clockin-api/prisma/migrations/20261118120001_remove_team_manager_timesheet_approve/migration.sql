-- Team managers no longer approve timesheets (project-owner PM + admin/owner only).
DELETE FROM "permissions"
WHERE "id" = '00000000-0000-4000-8000-000000000067';
