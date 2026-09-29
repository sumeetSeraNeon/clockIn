/**
 * Linux/Render-safe runner for seed-prod (avoids ts-node --compiler-options shell quoting).
 */
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    moduleResolution: 'node',
    esModuleInterop: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
  },
});
require('../prisma/seed-prod.ts');
