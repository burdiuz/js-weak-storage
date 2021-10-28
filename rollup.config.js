import typescript from '@rollup/plugin-typescript';

export default {
  input: 'source/index.ts',
  output: [
    {
      file: 'index.js',
      format: 'cjs',
    },
    {
      file: 'index.es.js',
      format: 'es',
    },
    {
      name: 'WeakStorage',
      file: 'dist/weak-storage.umd.js',
      format: 'umd',
    },
  ],
  plugins: [typescript()],
};
