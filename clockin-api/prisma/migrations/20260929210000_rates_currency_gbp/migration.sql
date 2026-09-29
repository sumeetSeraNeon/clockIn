-- Align rate currency with organisation default (GBP)
UPDATE "rates" SET "currency" = 'GBP' WHERE "currency" IS NULL OR "currency" = 'USD';
