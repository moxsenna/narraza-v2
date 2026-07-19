/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-boundary',
      comment: 'packages/core must not import db, ai, next, or @prisma',
      severity: 'error',
      from: { path: '^packages/core/' },
      to: {
        dependencyTypes: ['npm'],
        path: ['@prisma/client', 'next', 'react', 'react-dom'],
      },
    },
    {
      name: 'core-no-db',
      comment: 'core must not import @narraza/db',
      severity: 'error',
      from: { path: '^packages/core/' },
      to: { path: '^packages/db/' },
    },
    {
      name: 'core-no-ai',
      comment: 'core must not import @narraza/ai',
      severity: 'error',
      from: { path: '^packages/core/' },
      to: { path: '^packages/ai/' },
    },
    {
      name: 'application-boundary',
      comment: 'packages/application must not import @prisma/client directly',
      severity: 'error',
      from: { path: '^packages/application/' },
      to: {
        dependencyTypes: ['npm'],
        path: '@prisma/client',
      },
    },
    {
      name: 'web-no-prisma-client',
      comment: 'apps/web must not import @prisma/client',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: {
        dependencyTypes: ['npm'],
        path: '@prisma/client',
      },
    },
    {
      name: 'web-boundary',
      comment:
        'apps/web outside lib/server must not import @narraza/db — use app/lib/server composition root',
      severity: 'error',
      from: {
        path: '^apps/web/',
        pathNot: '^apps/web/app/lib/server/',
      },
      to: {
        path: ['@narraza/db', '^packages/db/'],
      },
    },
    {
      name: 'ai-boundary',
      comment: 'packages/ai must not import @narraza/db',
      severity: 'error',
      from: { path: '^packages/ai/' },
      to: { path: '^packages/db/' },
    },
    {
      name: 'worker-boundary',
      comment:
        'apps/worker-* must not import deep domain internals beyond application public API',
      severity: 'error',
      from: { path: '^apps/worker-' },
      to: {
        path: '^packages/core/',
        pathNot: '^packages/core/dist/(index\.d\.ts|index\.js)',
      },
    },
  ],
  options: {
    doNotFollow: {
      path: ['node_modules', 'dist'],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'node', 'require'],
      extensions: ['.js', '.ts', '.tsx', '.jsx'],
    },
    moduleSystems: ['es6', 'cjs'],
    prefix: 'v2',
    preserveSymlinks: false,
    combinedDependencies: false,
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
