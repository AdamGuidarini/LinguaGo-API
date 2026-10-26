import { defineConfig } from "eslint/config";
import stylistic from '@stylistic/eslint-plugin'
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default defineConfig({
    files: ["**/*.ts"],
    extends: [
        eslint.configs.recommended,
        tseslint.configs.strict,
        tseslint.configs.stylistic,
    ],
    plugins: {
        '@stylistic': stylistic
    },
    rules: {
        '@stylistic/quotes': ['error', 'single'],
        '@stylistic/semi': ['error', 'always'],
        '@stylistic/object-curly-spacing': ['error', 'always'],
        '@stylistic/array-bracket-newline': ['error', { 'multiline': true }],
        '@stylistic/curly-newline': [
            'error',
            {
                IfStatementConsequent: 'always',
                IfStatementAlternative: 'always',
                ForStatement: 'always',
                ForInStatement: 'always',
                WhileStatement: 'always',
                DoWhileStatement: 'always',
                SwitchStatement: 'always',
                SwitchCase: 'always',
                TryStatementBlock: 'always',
                TryStatementHandler: 'always',
                TryStatementFinalizer: 'always',
                BlockStatement: 'always',
                ArrowFunctionExpression: 'always',
                FunctionDeclaration: 'always',
                FunctionExpression: 'always',
                Property: { 'multiline': true },
                ClassBody: 'always',
                StaticBlock: 'always',
                WithStatement: 'always',
                TSModuleBlock: 'always',
            }
        ]
    }
});
