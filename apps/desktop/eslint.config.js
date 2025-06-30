import { config as baseConfig } from '@repo/eslint-config/react-internal';

export default [
  ...baseConfig,
  {
    ignores: ['dist/**', 'src-tauri/**'],
  },
]; 