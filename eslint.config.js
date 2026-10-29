import pluginVue from 'eslint-plugin-vue';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';

export default defineConfigWithVueTs(
  { ignores: ['dist/**', 'dist-firefox/**', 'node_modules/**', 'public/pageWorld.js', 'store/src/**'] },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    rules: {
      // Formatting is Prettier's job.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
    },
  },
);
