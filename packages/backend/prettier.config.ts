/** @type { PrettierConfig } */
export default {
  plugins: [],
  importOrder: [
    '<BUILT_IN_MODULES>',
    '<THIRD_PARTY_MODULES>',
    '^#(.*)/(.*)$',
    '^@(.*)/(.*)$',
    '^~/',
    '^[../]',
    '^[./]',
  ],
  printWidth: 80,
  semi: true,
  singleQuote: true,
};
