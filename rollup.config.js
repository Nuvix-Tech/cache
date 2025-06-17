import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';

const external = ['ioredis', 'redis', 'memcached', '@nuvix/telemetry'];

// Helper function to create adapter builds
const createAdapterBuild = (adapterName) => [
  // ESM build
  {
    input: `src/adapters/${adapterName}.ts`,
    output: {
      file: `dist/adapters/${adapterName}.esm.js`,
      format: 'esm',
      sourcemap: true,
    },
    external,
    plugins: [
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.build.json',
        declaration: false,
        outDir: 'dist',
        rootDir: 'src',
      }),
    ],
  },
  // CJS build
  {
    input: `src/adapters/${adapterName}.ts`,
    output: {
      file: `dist/adapters/${adapterName}.cjs.js`,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    external,
    plugins: [
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.build.json',
        declaration: false,
        outDir: 'dist',
        rootDir: 'src',
      }),
    ],
  },
  // Type definitions
  {
    input: `src/adapters/${adapterName}.ts`,
    output: {
      file: `dist/adapters/${adapterName}.d.ts`,
      format: 'esm',
    },
    external,
    plugins: [dts()],
  },
];

const config = [
  // Main ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    external,
    plugins: [
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.build.json',
        declaration: false,
        outDir: 'dist',
        rootDir: 'src',
      }),
    ],
  },
  // Main CJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    external,
    plugins: [
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.build.json',
        declaration: false,
        outDir: 'dist',
        rootDir: 'src',
      }),
    ],
  },
  // Main type definitions
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    external,
    plugins: [dts()],
  },
  // Adapter builds
  ...createAdapterBuild('redis'),
  ...createAdapterBuild('memory'),
  ...createAdapterBuild('memcached'),
  ...createAdapterBuild('none'),
];

export default config;
