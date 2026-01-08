# GitHub Pages Documentation

This directory contains the GitHub Pages website for the stable-request library.

## 🌐 Live Site

Once deployed, the site will be available at: `https://[your-username].github.io/stable-request/`

## 📁 Structure

```
docs/
├── index.html           # Landing page
├── documentation.html   # Full API documentation
├── examples.html        # Production-ready examples
└── styles.css          # Responsive styles with dark theme
```

## 🚀 Deployment

### Option 1: GitHub Pages (Recommended)

1. **Push to GitHub:**
   ```bash
   git add docs/
   git commit -m "Add GitHub Pages site"
   git push origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Navigate to Settings → Pages
   - Under "Source", select `main` branch and `/docs` folder
   - Click Save
   - Your site will be live at `https://[username].github.io/stable-request/`

### Option 2: Local Preview

You can preview the site locally using any HTTP server:

```bash
# Using Python
cd docs
python3 -m http.server 8000

# Using Node.js (npx)
npx serve docs

# Using PHP
cd docs
php -S localhost:8000
```

Then visit `http://localhost:8000` in your browser.

## ✨ Features

### Landing Page (index.html)
- Hero section with clear value proposition
- Feature showcase with 6 key capabilities
- Quick start examples with syntax highlighting
- Core features breakdown
- Common use cases
- Call-to-action sections

### Documentation (documentation.html)
- Sticky sidebar navigation
- Comprehensive API reference
- All core functions documented
- Retry strategies explained
- Circuit breaker patterns
- Workflow execution patterns
- Best practices guide
- Interactive examples

### Examples (examples.html)
- 5 production-ready examples
- Data synchronization pipeline
- Microservice orchestration
- API health monitoring
- Batch image processing
- Feature flag testing
- Full code samples with explanations

### Design Features
- Modern dark theme
- Responsive layout (mobile-friendly)
- Smooth animations
- Syntax highlighting for code
- Gradient accents
- Custom scrollbars
- Accessible navigation

## 🎨 Customization

### Colors
Edit CSS variables in `styles.css`:
```css
:root {
    --primary-color: #6366f1;
    --secondary-color: #ec4899;
    --accent-color: #14b8a6;
    /* ... more variables */
}
```

### Content
- Update repository links in navigation and footer
- Modify examples in `examples.html`
- Add more API documentation in `documentation.html`
- Update package name and author information

## 📦 Dependencies

The site uses CDN-hosted libraries:
- Highlight.js (v11.9.0) - Code syntax highlighting
- No build process required
- Pure HTML/CSS/JS

## 🔧 Maintenance

### Adding New Examples
Edit `examples.html` and add a new `.example-item` section following the existing pattern.

### Updating Documentation
Edit `documentation.html` and update the relevant sections. The sidebar navigation will automatically work with anchor links.

### Modifying Styles
All styles are in `styles.css`. The design uses CSS variables for easy theming.

## 📱 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## 🐛 Troubleshooting

### Site not loading after deployment
- Wait 5-10 minutes for GitHub Pages to build
- Check Settings → Pages for deployment status
- Ensure `/docs` folder is selected as source

### Styles not loading
- Check that `styles.css` is in the same directory as HTML files
- Clear browser cache
- Verify file paths in HTML `<link>` tags

### Code highlighting not working
- Check internet connection (CDN resources)
- Verify Highlight.js script tags are present
- Ensure `hljs.highlightAll()` is called in script tag

## 📄 License

This documentation site is part of the stable-request project and follows the same MIT License.
