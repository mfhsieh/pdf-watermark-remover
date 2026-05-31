import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default [
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                pdfLib: "readonly",
                PDFLib: "readonly",
                State: "writable",
                Utils: "readonly"
            },
            ecmaVersion: 2022,
            sourceType: "module",
        },
        rules: {
            "no-unused-vars": "off",
            "no-console": "off",
        }
    },
    eslintPluginPrettierRecommended,
];
