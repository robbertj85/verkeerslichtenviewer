import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Priority category colors
        emergency: '#dc2626',      // red-600
        road_operator: '#f97316',  // orange-500
        public_transport: '#2563eb', // blue-600
        logistics: '#16a34a',      // green-600
        agriculture: '#ca8a04',    // yellow-600
      },
    },
  },
  plugins: [],
} satisfies Config;
