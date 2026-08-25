// Registry of selectable public-site color themes.
// To add a new theme: drop a CSS file into public/themes/ (it can override the
// CSS custom properties and rules defined in public/gocon-theme.css), then add
// an entry below pointing `files` at it in load order. The theme becomes
// selectable in /admin/graphics automatically — no other code changes needed.
module.exports = [
    {
        id: 'classic',
        name: 'Classic',
        description: 'Original GoCon interface',
        colors: ['#0f172a', '#38bdf8', '#ffffff'],
        files: []
    },
    {
        id: 'studio',
        name: 'Studio',
        description: 'Clean editorial festival look',
        colors: ['#f5f6f8', '#087f8c', '#df3f73'],
        files: ['gocon-theme.css']
    },
    {
        id: 'night',
        name: 'Night Aurora',
        description: 'Moody dark mode with coral & teal glow',
        colors: ['#0b0f14', '#4fd1c5', '#ff7a59'],
        files: ['gocon-theme.css', 'themes/night.css']
    },
    {
        id: 'citrus',
        name: 'Terracotta Grove',
        description: 'Warm organic daytime palette',
        colors: ['#faf6ef', '#5f8d63', '#d1603a'],
        files: ['gocon-theme.css', 'themes/citrus.css']
    },
    {
        id: 'stardust',
        name: 'Stardust Gala',
        description: 'Near-black navy with periwinkle, rose & gold accents',
        colors: ['#0b0e1a', '#5b6fc9', '#f0a83c'],
        files: ['gocon-theme.css', 'themes/stardust.css']
    }
];
