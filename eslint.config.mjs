import tseslint from "typescript-eslint";

export default tseslint.config([
  {
    ignores: ["**/dist/**", "**/node_modules/**", "coverage/**"],
  },
  {
    files: ["**/*.ts"],
    extends: [tseslint.configs.recommended],
    rules: {
      "no-console": "off",
    },
  },
]);
