/**
 * Render start command helper.
 *
 * Neon + prisma migrate deploy can hit P1002 (advisory lock timeout) when a
 * prior deploy left a lock held, or when multiple deploys race. This service
 * is a single instance, so disabling the advisory lock for migrate is safe.
 *
 * Usage (Render Start Command):
 *   node scripts/render-start.js
 */
const { spawnSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

process.env.PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK = '1';

function run(command, args) {
  console.log(`> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function wakeDatabase() {
  const prisma = new PrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database reachable');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Database wake probe failed (continuing): ${message}`);
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

async function main() {
  await wakeDatabase();
  run('npx', ['prisma', 'migrate', 'deploy']);
  run('npm', ['run', 'seed:prod']);
  run('npm', ['run', 'start:prod']);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
