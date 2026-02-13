import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
    // Ignore patterns
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/.next/**',
            '**/coverage/**',
            '**/playwright-report/**',
            '**/test-results/**',
            '**/load-tests/**',
            '**/*.config.js',
            '**/*.config.mjs',
        ],
    },

    // Base configuration for all TypeScript files
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: 'module',
            },
            globals: {
                ...globals.node,
                ...globals.es2021,
                RequestInit: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            ...js.configs.recommended.rules,
            ...tseslint.configs.recommended.rules,

            // Custom rules
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            'no-console': 'off',
            'prefer-const': 'error',
            'no-var': 'error',
        },
    },

    // Browser environment for web package
    {
        files: ['packages/web/**/*.ts', 'packages/web/**/*.tsx'],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2021,
                React: 'readonly',
                RequestInit: 'readonly',
            },
        },
    },

    // Test files - more lenient rules
    {
        files: [
            '**/*.test.ts',
            '**/*.spec.ts',
            '**/src/test/**/*.ts',
            '**/e2e/**/*.ts',
        ],
        languageOptions: {
            globals: {
                ...globals.node,
                expect: 'readonly',
                describe: 'readonly',
                it: 'readonly',
                beforeEach: 'readonly',
                afterEach: 'readonly',
                beforeAll: 'readonly',
                afterAll: 'readonly',
                vi: 'readonly',
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
        },
    },

    // Config and script files - more lenient rules
    {
        files: [
            'scripts/**/*.ts',
            '*.config.ts',
            '*.config.mjs',
            '*.config.js',
        ],
        languageOptions: {
            globals: {
                ...globals.node,
                __dirname: 'readonly',
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
        },
    },
];
