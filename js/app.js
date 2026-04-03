// ===========================
// CivicEye – App Core Utils
// ===========================
import { auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Dark Mode
const DarkMode = {
  init() {
    const saved = localStorage.getItem('civiceye-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    this.updateToggles(saved);
  },
  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('civiceye-theme', next);
    this.updateToggles(next);
  },
  updateToggles(theme) {
    document.querySelectorAll('.dark-toggle').forEach(btn => {
      btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
      btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    });
  }
};

// Toast Notifications
const Toast = {
  container: null,
  init() {
    if (!document.getElementById('toast-container')) {
      this.container = document.createElement('div');
      this.container.id = 'toast-container';
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById('toast-container');
    }
  },
  show(title, message = '', type = 'info', duration = 4000) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: '💡' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
    `;
    this.container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 250);
      }
    }, duration);
  },
  success(title, msg) { this.show(title, msg, 'success'); },
  error(title, msg) { this.show(title, msg, 'error'); },
  warning(title, msg) { this.show(title, msg, 'warning'); },
  info(title, msg) { this.show(title, msg, 'info'); }
};

// Scroll Animations
const ScrollReveal = {
  init() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => {
      observer.observe(el);
    });
  }
};

// Counter Animation
const CounterAnim = {
  animate(el, target, duration = 1500) {
    const start = performance.now();
    const update = (time) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  },
  initAll() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.count, 10);
          this.animate(el, target);
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    document.querySelectorAll('[data-count]').forEach(el => observer.observe(el));
  }
};

// Navbar scroll effect
const NavbarScroll = {
  init() {
    const nav = document.querySelector('.navbar');
    if (!nav) return;
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });
  }
};

// Ripple effect on buttons
const Ripple = {
  init() {
    document.querySelectorAll('.btn-ripple').forEach(btn => {
      btn.addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const size = Math.max(rect.width, rect.height) * 2;
        const ripple = document.createElement('span');
        ripple.className = 'ripple-circle';
        ripple.style.cssText = `width:${size}px;height:${size}px;left:${x - size/2}px;top:${y - size/2}px`;
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
      });
    });
  }
};

// Mobile Nav
const MobileNav = {
  init() {
    const hamburger = document.querySelector('.nav-hamburger');
    const mobileNav = document.querySelector('.mobile-nav');
    if (!hamburger || !mobileNav) return;
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('open');
      mobileNav.classList.toggle('open');
    });
    document.querySelectorAll('.mobile-nav .nav-link').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileNav.classList.remove('open');
      });
    });
  }
};

// Mark Active Nav Link
function markActiveNav() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .sidebar-link, .mobile-nav .nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

// Fake Validation Logic (for demo)
const ValidationEngine = {
  check(imageProvided, description, location) {
    let score = 0;
    if (imageProvided) score += 40;
    if (description && description.length > 20) score += 30;
    if (location) score += 20;
    if (description && description.length > 50) score += 10;
    return score >= 60;
  },
  analyze(imageProvided, description, location) {
    const valid = this.check(imageProvided, description, location);
    return {
      valid,
      label: valid ? 'Verified' : 'Suspicious',
      confidence: valid ? Math.floor(Math.random() * 15 + 85) : Math.floor(Math.random() * 30 + 30),
      reason: valid
        ? 'Image, location & description provided. Passes AI validation.'
        : 'Missing key details. Provide image + location + description for verification.'
    };
  }
};

// Sample Complaints Data (demo)
const SampleComplaints = [
  {
    id: 'C001',
    title: 'Pothole on Main Avenue',
    category: 'Road',
    description: 'Large pothole causing vehicle damage near the main intersection.',
    location: { lat: 30.6942, lng: 76.7002, address: 'Main Avenue, Chandigarh' },
    status: 'pending',
    verified: true,
    votes: 47,
    date: '2026-04-01',
    image: null,
    userId: 'user001',
    userName: 'Rajesh Kumar'
  },
  {
    id: 'C002',
    title: 'Garbage Overflow – Sector 22',
    category: 'Garbage',
    description: 'Garbage bins overflowing for 3 days. Causing health hazards.',
    location: { lat: 30.7333, lng: 76.7794, address: 'Sector 22, Chandigarh' },
    status: 'resolved',
    verified: true,
    votes: 83,
    date: '2026-03-28',
    image: null,
    userId: 'user002',
    userName: 'Priya Sharma'
  },
  {
    id: 'C003',
    title: 'Water Pipeline Leak',
    category: 'Water',
    description: 'Broken pipeline causing water wastage and road damage.',
    location: { lat: 30.7046, lng: 76.7179, address: 'Phase 7, Mohali' },
    status: 'delayed',
    verified: false,
    votes: 12,
    date: '2026-03-20',
    image: null,
    userId: 'user003',
    userName: 'Amit Singh'
  },
  {
    id: 'C004',
    title: 'Street Light Not Working',
    category: 'Electricity',
    description: 'Multiple street lights not working on the highway causing unsafe conditions.',
    location: { lat: 30.7200, lng: 76.7900, address: 'Highway 21, Punjab' },
    status: 'processing',
    verified: true,
    votes: 35,
    date: '2026-03-30',
    image: null,
    userId: 'user004',
    userName: 'Sunita Devi'
  },
  {
    id: 'C005',
    title: 'Tree Fallen on Road',
    category: 'Other',
    description: 'Large tree has fallen on road after storm, blocking traffic.',
    location: { lat: 30.6800, lng: 76.7100, address: 'Zirakpur Road' },
    status: 'resolved',
    verified: true,
    votes: 29,
    date: '2026-04-01',
    image: null,
    userId: 'user001',
    userName: 'Rajesh Kumar'
  },
  {
    id: 'C006',
    title: 'Broken Drainage System',
    category: 'Drainage',
    description: 'Open drain causing flooding during rains near residential area.',
    location: { lat: 30.7150, lng: 76.7650, address: 'Panchkula Sector 10' },
    status: 'pending',
    verified: true,
    votes: 61,
    date: '2026-03-25',
    image: null,
    userId: 'user005',
    userName: 'Vikram Rao'
  }
];

// User Profile Data (demo)
let currentUser = {
  uid: 'user001',
  name: 'Rajesh Kumar',
  email: 'rajesh.kumar@example.com',
  phone: '+91 98765 43210',
  city: 'Chandigarh',
  bio: 'Active civic reporter helping improve our community.',
  trustScore: 82,
  totalComplaints: 14,
  resolvedComplaints: 9,
  pendingComplaints: 3,
  badge: 'trusted',
  joinDate: 'January 2026',
  avatar: null,
  isLoggedIn: true
};

// Save/Load user from localStorage
function saveUser(data) {
  localStorage.setItem('civiceye-user', JSON.stringify(data));
}

function loadUser() {
  const stored = localStorage.getItem('civiceye-user');
  if (stored) {
    try { currentUser = { ...currentUser, ...JSON.parse(stored) }; } catch(e) {}
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  DarkMode.init();
  Toast.init();
  ScrollReveal.init();
  CounterAnim.initAll();
  NavbarScroll.init();
  Ripple.init();
  MobileNav.init();
  markActiveNav();
  loadUser();

  // Seamless real-time location capture & caching
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      localStorage.setItem('civiceye_lat', pos.coords.latitude);
      localStorage.setItem('civiceye_lng', pos.coords.longitude);
      
      // Attempt to actively seamlessly update local map instance if present
      if (typeof civicMap !== 'undefined' && civicMap && typeof L !== 'undefined') {
        civicMap.setView([pos.coords.latitude, pos.coords.longitude], 14);
      }
    }, err => console.warn('Seamless location access denied.', err), { maximumAge: 60000 });
  }

  // Dark toggle click
  document.querySelectorAll('.dark-toggle').forEach(btn => {
    btn.addEventListener('click', () => DarkMode.toggle());
  });

  // Auth Protection Logic via Firebase
  const currentPagePath = window.location.pathname.split('/').pop() || 'index.html';
  const restrictedPages = ['report.html', 'dashboard.html', 'map.html', 'community.html', 'tracker.html', 'profile.html'];

  onAuthStateChanged(auth, (user) => {
    const isLoggedIn = !!user;

    // 1. Guard restricted pages natively
    if (restrictedPages.includes(currentPagePath) && !isLoggedIn) {
      window.location.href = 'auth.html';
    }

    // 2. Intercept protected links
    document.removeEventListener('click', linkInterceptor);
    document.addEventListener('click', linkInterceptor);

    function linkInterceptor(e) {
      const link = e.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href) return;
      
      if (restrictedPages.some(page => href.includes(page))) {
        if (!isLoggedIn) {
          e.preventDefault();
          window.location.href = 'auth.html';
        }
      }
    }

    // 3. Update Navbars natively
    updateAuthUI(isLoggedIn);
  });

  // Handle Logout globally via Firebase
  document.addEventListener('click', async (e) => {
    if (e.target.closest('.logout-btn')) {
      e.preventDefault();
      try {
        await signOut(auth);
        Toast.info('Logged out', 'You have been successfully logged out.');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 600);
      } catch (err) {
        console.error('Logout error', err);
      }
    }
  });

  // Auth UI Toggle (Dynamic Navbar)
  function updateAuthUI(isLoggedIn) {
    // Handle Desktop Nav Actions
    document.querySelectorAll('.nav-actions').forEach(nav => {
      // Login button
      const modalLoginBtn = nav.querySelector('.btn-login-nav') || nav.querySelector('a[href="auth.html"]:not(.btn-primary)');
      const bell = nav.querySelector('.nav-bell');
      const reportBtn = nav.querySelector('a[href="report.html"].btn');

      // Show Login button only when logged out
      if (modalLoginBtn) modalLoginBtn.style.display = isLoggedIn ? 'none' : 'flex';
      // Bell and Report only when logged in
      if (bell) bell.style.display = isLoggedIn ? 'flex' : 'none';
      if (reportBtn) reportBtn.style.display = isLoggedIn ? 'inline-flex' : 'none';

      // Logout button (only when logged in)
      let logoutBtn = nav.querySelector('.logout-btn');
      const hamburger = nav.querySelector('.nav-hamburger');
      if (!logoutBtn) {
        logoutBtn = document.createElement('button');
        logoutBtn.className = 'btn btn-outline btn-sm logout-btn';
        logoutBtn.textContent = 'Log Out';
        logoutBtn.style.padding = '6px 12px';
        if (hamburger) nav.insertBefore(logoutBtn, hamburger);
        else nav.appendChild(logoutBtn);
      }
      logoutBtn.style.display = isLoggedIn ? 'inline-flex' : 'none';
    });

    // Handle Mobile Nav
    document.querySelectorAll('.mobile-nav').forEach(mNav => {
      const reportBtn = mNav.querySelector('a[href="report.html"].btn-primary');
      if (reportBtn) reportBtn.style.display = isLoggedIn ? 'flex' : 'none';

      // Mobile login link
      const mLoginLink = mNav.querySelector('.m-modal-login') || mNav.querySelector('a[href="auth.html"]');
      if (mLoginLink) mLoginLink.style.display = isLoggedIn ? 'none' : 'block';

      let mLogoutLink = mNav.querySelector('.m-logout-link');
      if (!mLogoutLink) {
        mLogoutLink = document.createElement('button');
        mLogoutLink.className = 'btn btn-outline logout-btn m-logout-link';
        mLogoutLink.style.width = '100%';
        mLogoutLink.style.justifyContent = 'center';
        mLogoutLink.style.marginTop = '10px';
        mLogoutLink.textContent = 'Log Out';
        mNav.appendChild(mLogoutLink);
      }
      mLogoutLink.style.display = isLoggedIn ? 'flex' : 'none';
    });
  }
});
