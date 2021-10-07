// SPDX-FileCopyrightText: 2021 Collabora, Ltd
//
// SPDX-License-Identifier: CC0-1.0

module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    parserOptions: {
        "ecmaVersion": 6,
        "sourceType": "module"
    },
    plugins: [
        "@typescript-eslint"
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    ignorePatterns: [
        "lib",
        "**/*.d.ts"
    ]
}
