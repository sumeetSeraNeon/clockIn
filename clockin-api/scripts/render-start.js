/**
 * Render start command helper.
 *
 * Neon + prisma migrate deploy can hit P1002 (advisory lock timeout) when a
 * prior deploy left a lock held, or when multiple deploys race. This service
 * is a single instance, so disabling the advisory lock for migrate is safe.
 *
 * Important: Render's port scanner fails if we spend too long before the HTTP
 * server binds 0.0.0.0:$PORT. So we migrate, then start immediately. Seed is
 * opt-in (SEED_ON_START=1) so it cannot block deploys.
 *
 * Usage (Render Start Command):
 *   node scripts/render-start.js
 */
const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = '1';

function run(command, args, opts = {}) {
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
    ...opts,
  });
  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function wakeDatabase() {
  const prisma = new PrismaClient();
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log(`Database reachable (${Date.now() - started}ms)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Database wake probe failed (continuing): ${message}`);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

async function main() {
  console.log(
    `render-start: PORT=${process.env.PORT ?? '(unset)'} SEED_ON_START=${process.env.SEED_ON_START ?? '0'}`,
  );
  await wakeDatabase();
  run('npx', ['prisma', 'migrate', 'deploy']);

  // Seed every deploy used to delay listen past Render's port-scan timeout.
  if (process.env.SEED_ON_START === '1') {
    run('npm', ['run', 'seed:prod']);
  } else {
    console.log(
      'Skipping seed:prod (set SEED_ON_START=1 once if you need a bootstrap seed)',
    );
  }

  run('npm', ['run', 'start:prod']);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
