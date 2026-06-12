import type { Preview } from '@storybook/nextjs-vite'
import "../src/app/globals.css";

const preview: Preview = {
  initialGlobals: {
    backgrounds: { value: "surface" },
  },
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    },

    backgrounds: {
      options: {
        surface: { name: "surface", value: "#0b0d12" },
      },
    },
  },
};

export default preview;