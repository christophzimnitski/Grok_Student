export class ThemeManager {
    constructor() {
        this.themeToggle = document.getElementById('theme-toggle');
        this.themes = ['auto', 'light', 'dark'];
        this.currentThemeIndex = 0;
        this.currentTheme = this.themes[this.currentThemeIndex];

        this.init();
    }

    init() {
        this.setTheme(this.currentTheme);
        this.updateHljsTheme();

        this.themeToggle.addEventListener('click', () => {
            this.currentThemeIndex = (this.currentThemeIndex + 1) % this.themes.length;
            this.currentTheme = this.themes[this.currentThemeIndex];
            this.setTheme(this.currentTheme);
            this.updateHljsTheme();
        });

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (document.body.dataset.theme === 'auto') {
                this.updateHljsTheme();
            }
        });
    }

    setTheme(theme) {
        document.body.dataset.theme = theme;
        localStorage.setItem('theme', theme);
        if (this.themeToggle) {
            this.themeToggle.textContent = `Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`;
        }
    }

    updateHljsTheme() {
        const light = document.getElementById('hljs-light');
        const dark = document.getElementById('hljs-dark');
        if (!light || !dark) return;

        const isDark = document.body.dataset.theme === 'dark' ||
                       (document.body.dataset.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

        light.media = isDark ? 'not all' : 'all';
        dark.media = isDark ? 'all' : 'not all';
    }
}
