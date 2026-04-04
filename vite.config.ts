import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		port: 1618,
	},
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		tanstackStart({ router: { routeFileIgnorePrefix: '-' } }),
		// React's Vite plugin must come after TanStack Start's Vite plugin.
		react(),
		babel({ presets: [reactCompilerPreset()] }),
		tailwindcss(),
	],
});
