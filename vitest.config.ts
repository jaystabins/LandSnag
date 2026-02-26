import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'node',
        globals: true,
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        include: [
            'src/**/*.test.ts',
            'src/**/*.test.tsx',
            'src/**/*.spec.ts',
            'src/**/*.spec.tsx',
            '__tests__/**/*.test.ts',
            '__tests__/**/*.test.tsx',
            '__tests__/**/*.spec.ts',
            '__tests__/**/*.spec.tsx'
        ],
        setupFiles: ['./src/__tests__/setup.ts'],
        testTimeout: 10000,
        hookTimeout: 10000,
        isolate: false
    },
});
