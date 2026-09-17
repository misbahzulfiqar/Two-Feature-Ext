/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "var(--ss-bg)",
        surface: "var(--ss-bg-secondary)",
        card: "var(--ss-card)",
        "card-2": "var(--ss-card-2)",
        line: "var(--ss-border)",
        ink: "var(--ss-text)",
        mute: "var(--ss-text-secondary)",
        faint: "var(--ss-text-muted)",
        violet: "var(--ss-purple)",
        "violet-bright": "var(--ss-purple-bright)",
        "violet-hot": "var(--ss-purple-hot)",
        azure: "var(--ss-blue)",
        ok: "var(--ss-success)",
        warn: "var(--ss-warning)",
        "admin-bg": "var(--admin-bg)",
        "admin-sidebar": "var(--admin-sidebar)",
        "admin-card": "var(--admin-card)",
        "admin-card-2": "var(--admin-card-2)",
        "admin-border": "var(--admin-border)",
        "admin-purple": "var(--admin-purple)",
        "admin-info": "var(--admin-info)",
      },
      maxWidth: {
        shell: "1240px",
      },
      borderRadius: {
        card: "16px",
        btn: "10px",
        field: "9px",
      },
      boxShadow: {
        cta: "0 10px 28px color-mix(in srgb, var(--ss-purple) 45%, transparent)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
