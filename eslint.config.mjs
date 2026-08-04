import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import prettierConfig from 'eslint-config-prettier';

const eslintConfig = [
  ...nextCoreWebVitals,
  prettierConfig,
  {
    rules: {
      // flags setState-on-mount patterns used here to detect client-only
      // state (hydration, browser-only URL/hash reads) that cannot run
      // during the initial render
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default eslintConfig;
