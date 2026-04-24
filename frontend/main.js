/* ============================================================
   PORTFOLIO — main.js  (SPA router)
   ============================================================ */
(function () {
  'use strict';

  /* ── THEME ── */
  const THEME_KEY = 'neferine-theme';

  function getTheme() {
    return localStorage.getItem(THEME_KEY) ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.textContent = theme === 'dark' ? 'Light' : 'Dark';
    });
    localStorage.setItem(THEME_KEY, theme);
  }

  const toggleTheme = () => applyTheme(getTheme() === 'dark' ? 'light' : 'dark');

  applyTheme(getTheme());

  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });

  /* ── ELEMENTS ── */
  const mainContent = document.getElementById('main-content');
  const sidebar     = document.getElementById('sidebar');
  const backdrop    = document.getElementById('sidebar-backdrop');
  const burger      = document.querySelector('.burger');

  /* ── SECTION CACHE — avoid re-fetching the same partial ── */
  const cache = {};

  /* ── ROUTE MAP ── */
  // Maps a URL path segment → partial file path
  const routes = {
    '':         '/about/index.html',
    'about':    '/about/index.html',
    'projects': '/projects/index.html',
    'blog':     '/blog/index.html',
    'contact':  '/contact/index.html',
    'colophon': '/colophon/index.html',
    // Blog post routes — add new posts here
    'blog/why-rust':               '/blog/why-rust/index.html',
    'blog/wasm-not-js-replacement': '/blog/wasm-not-js-replacement/index.html',
    'blog/text-editor-from-scratch': '/blog/text-editor-from-scratch/index.html',
  };

  /* ── ESCAPE HTML — prevent XSS in error messages ── */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── NAVIGATE ── */
  async function navigate(path, pushState = true) {
    // Normalise: strip leading slash, trailing slash, and query string
    const segment = path.replace(/^\/|\/$/g, '').split('?')[0];

    // Check if route exists; show 404 for unknown routes
    const partial = routes[segment] ?? null;
    const notFound = partial === null && segment !== '';

    // Update URL without reload
    const newUrl = segment ? `/${segment}` : '/';
    if (pushState && window.location.pathname !== newUrl) {
      history.pushState({ path: segment }, '', newUrl);
    }

    // FIX: Blog post pages should keep "Blog" nav item active
    const navSegment = segment.startsWith('blog/') ? 'blog' : (segment || 'about');

    // Update nav active state
    document.querySelectorAll('.nav-link[data-route]').forEach(link => {
      const active = link.dataset.route === navSegment;
      link.classList.toggle('active', active);
      active
        ? link.setAttribute('aria-current', 'page')
        : link.removeAttribute('aria-current');
    });

    // Fade out current content
    mainContent.style.opacity = '0';
    mainContent.style.transform = 'translateY(4px)';

    // Handle 404
    if (notFound) {
      mainContent.innerHTML = `
        <section class="section active visible" id="not-found">
          <h1 class="section-title">Page not found</h1>
          <hr class="rule">
          <p class="lead">That page doesn't exist.</p>
          <p class="body">
            <a href="/about" data-route="about" style="color:var(--accent)">← Go home</a>
          </p>
        </section>`;
      mainContent.style.transition = 'opacity 220ms ease, transform 220ms ease';
      requestAnimationFrame(() => {
        mainContent.style.opacity = '1';
        mainContent.style.transform = 'translateY(0)';
      });
      return;
    }

    const resolvedPartial = partial ?? routes[''];

    // Fetch partial (with cache)
    let html;
    if (cache[resolvedPartial]) {
      html = cache[resolvedPartial];
    } else {
      try {
        const res = await fetch(resolvedPartial);
        if (!res.ok) throw new Error(`${res.status} ${res.url}`);
        html = await res.text();
        cache[resolvedPartial] = html;
      } catch (err) {
        console.error('Router fetch failed:', err);
        html = `<section class="section active visible" id="error">
                  <h1 class="section-title">Something went wrong</h1>
                  <hr class="rule">
                  <p class="lead">That section failed to load.</p>
                  <p class="body">Path: ${escapeHtml(path)}</p>
                </section>`;
      }
    }

    // Inject & animate in
    mainContent.innerHTML = html;

    // Re-apply theme to any new .theme-toggle buttons injected by partial
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.textContent = getTheme() === 'dark' ? 'Light' : 'Dark';
      btn.addEventListener('click', toggleTheme);
    });

    // Mark the injected section active + visible
    const section = mainContent.querySelector('.section');
    if (section) {
      section.classList.add('active');
      requestAnimationFrame(() => {
        section.classList.add('visible');
        stagger(section);
      });
    }

    // Update document title from data attribute
    const title = section?.dataset?.title;
    if (title) document.title = title;

    // Re-init any section-specific JS hooks
    initSectionHooks();

    // Fade back in
    mainContent.style.transition = 'opacity 220ms ease, transform 220ms ease';
    requestAnimationFrame(() => {
      mainContent.style.opacity = '1';
      mainContent.style.transform = 'translateY(0)';
    });

    mainContent.scrollTop = 0;
    closeSidebar();
  }

  /* ── STAGGER ANIMATION for list items ── */
  function stagger(section) {
    section.querySelectorAll('.project, .post').forEach((el, i) => {
      el.classList.remove('in');
      setTimeout(() => el.classList.add('in'), i * 60);
    });
  }

  /* ── RE-INIT HOOKS after partial inject ── */
  function initSectionHooks() {
    // Email copy button
    const copyBtn = document.getElementById('copy-email-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        navigator.clipboard.writeText('neferine@tutamail.com').then(() => {
          const orig = copyBtn.textContent;
          copyBtn.textContent = 'Copied!';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = orig;
            copyBtn.classList.remove('copied');
          }, 2000);
        });
      });
    }

    // FIX: Calculate reading time from actual word count instead of title keywords
    document.querySelectorAll('.post').forEach(post => {
      const timeEl = post.querySelector('.post-reading-time');
      if (!timeEl) return;
      // Try to get word count from excerpt; fallback to title length heuristic
      const excerptEl = post.querySelector('.post-excerpt');
      const words = excerptEl ? excerptEl.textContent.trim().split(/\s+/).length * 8 : 200;
      const mins = Math.max(1, Math.round(words / 200));
      timeEl.textContent = `${mins} min read`;
    });

    // Calculate reading time for blog post pages (actual article word count)
    const articleEl = document.querySelector('.blog-content');
    if (articleEl) {
      const wordCount = articleEl.textContent.trim().split(/\s+/).length;
      const mins = Math.max(1, Math.round(wordCount / 250));
      const metaEl = document.querySelector('.blog-meta');
      if (metaEl && !metaEl.querySelector('.reading-time')) {
        const span = document.createElement('span');
        span.className = 'reading-time';
        span.textContent = `${mins} min read`;
        metaEl.appendChild(span);
      }
    }
  }

  /* ── INTERCEPT all nav-link and blog link clicks ── */
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-route], a[href^="/blog/"], a[href^="/about"], a[href^="/projects"], a[href^="/contact"], a[href^="/colophon"]');
    if (!link) return;
    const href = link.getAttribute('href');
    // Let external links, rss, and hash-only links pass through
    if (!href || href.startsWith('http') || href.startsWith('#') || href === '/rss.xml') return;
    e.preventDefault();
    navigate(href);
  });

  /* ── BROWSER BACK / FORWARD ── */
  window.addEventListener('popstate', () => {
    navigate(window.location.pathname, false);
  });

  /* ── SIDEBAR ── */
  function openSidebar() {
    sidebar?.classList.add('open');
    backdrop?.classList.add('visible');
    burger?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('visible');
    burger?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  burger?.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });

  backdrop?.addEventListener('click', closeSidebar);

  /* ── KEYBOARD: N = toggle theme ── */
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'n' || e.key === 'N') &&
        !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      toggleTheme();
    }
  });

  /* ── INIT ── */
  // Navigate to current URL path on first load (no pushState since we're already there)
  navigate(window.location.pathname, false);

}());