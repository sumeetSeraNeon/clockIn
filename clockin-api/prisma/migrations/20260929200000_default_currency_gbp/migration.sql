-- Default organisation currency: USD → GBP
ALTER TABLE "organisations" ALTER COLUMN "currency" SET DEFAULT 'GBP';

-- Align existing org rows that still use the old default
UPDATE "organisations" SET "currency" = 'GBP' WHERE "currency" = 'USD';
