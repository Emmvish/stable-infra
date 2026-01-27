const sidebarToggle = document.getElementById('sidebarToggle');
const sidebar = document.getElementById('sidebar');
const mainContent = document.getElementById('mainContent');

sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    sidebar.classList.toggle('open');
    mainContent.classList.toggle('expanded');
});

function checkViewport() {
    if (window.innerWidth <= 1024) {
    sidebar.classList.add('collapsed');
    mainContent.classList.add('expanded');
    } else {
    sidebar.classList.remove('collapsed');
    mainContent.classList.remove('expanded');
    }
}
checkViewport();
window.addEventListener('resize', checkViewport);

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const sidebarTabLinks = document.querySelectorAll('.sidebar-nav a[data-tab]');

function activateTab(tabId) {
    tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    tabContents.forEach(content => {
    content.classList.toggle('active', content.id === 'tab-' + tabId);
    });
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
});

sidebarTabLinks.forEach(link => {
    link.addEventListener('click', (e) => {
    const tabId = link.dataset.tab;
    if (tabId) {
        activateTab(tabId);
    }
    });
});

function copyCode(btn) {
    const codeBox = btn.closest('.code-box');
    const code = codeBox.querySelector('code').innerText;
    
    navigator.clipboard.writeText(code).then(() => {
    btn.classList.add('copied');
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        Copied!
    `;
    
    setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Copy
        `;
    }, 2000);
    });
}

const sections = document.querySelectorAll('section[id]');
const sidebarLinks = document.querySelectorAll('.sidebar-nav a');

function updateActiveLink() {
    const scrollY = window.scrollY;
    
    sections.forEach(section => {
    const sectionTop = section.offsetTop - 100;
    const sectionHeight = section.offsetHeight;
    const sectionId = section.getAttribute('id');
    
    if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
        sidebarLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + sectionId) {
            link.classList.add('active');
        }
        });
    }
    });
}

window.addEventListener('scroll', updateActiveLink);
updateActiveLink();

sidebarLinks.forEach(link => {
    link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        }
        
        if (window.innerWidth <= 1024) {
        sidebar.classList.add('collapsed');
        sidebar.classList.remove('open');
        }
    }
    });
});