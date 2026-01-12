/**
 * CarVault - Car Listing Application
 * Features: Infinite scroll (optimized), filtering, navigation to details
 */

let allCars = [];
let filteredCars = [];
let displayedCount = 0;
const batchSize = 24;
let isLoading = false;
let favorites = new Set(JSON.parse(localStorage.getItem('favorites') || '[]'));
const DOWN_PAYMENT_PERCENT = 0.15;
let currentPersona = localStorage.getItem('persona') || 'all';
let compare = new Set(JSON.parse(sessionStorage.getItem('compare') || '[]'));
let aiLensExpanded = sessionStorage.getItem('aiLensExpanded') === '1';
let lastNlSearch = null;
let lastRawSearch = '';
let pulseState = { newListings: [], priceDrops: [], priceIncreases: [], ts: 0 };
let sharedShortlistIds = [];
const PULSE_STATE_KEY = 'pulseStateV1';
const PULSE_LAST_PRICE_KEY = 'pulseLastPricesV1';

// DOM Elements
const carGrid = document.getElementById('car-grid');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('empty-state');
const totalCarsEl = document.getElementById('total-cars');
const showingCount = document.getElementById('showing-count');
const totalCount = document.getElementById('total-count');
const scrollLoader = document.getElementById('scroll-loader');

const filterMake = document.getElementById('filter-make');
const filterModel = document.getElementById('filter-model');
const filterYear = document.getElementById('filter-year');
const filterPrice = document.getElementById('filter-price');
const filterBody = document.getElementById('filter-body');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const searchBtn = document.getElementById('search-btn');
const filterTags = document.querySelectorAll('.filter-tag');

const aiBriefModal = document.getElementById('ai-brief-modal');
const aiBriefTitle = document.getElementById('ai-brief-title');
const aiBriefBody = document.getElementById('ai-brief-body');
const personaLabel = document.getElementById('persona-label');
const rankingLabel = document.getElementById('ranking-label');
const savedBtn = document.getElementById('saved-btn');
const savedCountEl = document.getElementById('saved-count');
const headerSavedBtn = document.getElementById('header-saved-btn');
const headerSavedCountEl = document.getElementById('header-saved-count');
const resetBtn = document.getElementById('reset-btn');
const clearFiltersBtn = document.getElementById('clear-filters-btn');

const savedModal = document.getElementById('saved-modal');
const savedBody = document.getElementById('saved-body');
const compareBtn = document.getElementById('compare-btn');
const compareCountEl = document.getElementById('compare-count');
const compareModal = document.getElementById('compare-modal');
const compareBody = document.getElementById('compare-body');
const filtersToggleBtn = document.getElementById('filters-toggle-btn');
const filtersPanel = document.getElementById('filters-panel');
const filtersCloseBtn = document.getElementById('filters-close-btn');
const aiLens = document.getElementById('ai-lens');
const pulseBtn = document.getElementById('pulse-btn');
const pulseCountEl = document.getElementById('pulse-count');
const pulseModal = document.getElementById('pulse-modal');
const pulseBody = document.getElementById('pulse-body');
let lastFocusedElement = null;
let currentBriefCarId = null;
let pendingBriefCarId = null;
let briefCopyState = { carId: null, negotiationText: '', questionsText: '' };

// Toast Notification System
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
        });
    });
    
    // Auto remove
    setTimeout(() => {
        toast.classList.add('exiting');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, duration);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

function loadStoredJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed ?? fallback;
    } catch {
        return fallback;
    }
}

function persistStoredJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch { }
}

function buildShortlistLink(ids) {
    const clean = Array.from(new Set((ids || []).map(v => String(v).trim()).filter(Boolean))).slice(0, 40);
    if (clean.length === 0) return '';

    const params = new URLSearchParams();
    if (searchInput?.value) params.set('q', String(searchInput.value || '').trim());
    if (currentPersona) params.set('persona', String(currentPersona));
    if (filterBody?.value) params.set('body', String(filterBody.value));
    if (sortSelect?.value) params.set('sort', String(sortSelect.value));
    params.set('shortlist', clean.join(','));

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

function buildBriefLink(carId) {
    const id = String(carId || '').trim();
    if (!id) return '';

    const params = new URLSearchParams();
    if (searchInput?.value) params.set('q', String(searchInput.value || '').trim());
    if (currentPersona) params.set('persona', String(currentPersona));
    if (filterBody?.value) params.set('body', String(filterBody.value));
    if (sortSelect?.value) params.set('sort', String(sortSelect.value));
    params.set('brief', id);

    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

async function copyTextToClipboard(text) {
    const value = String(text || '');
    if (!value) return false;

    try {
        if (navigator?.clipboard?.writeText && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
            return true;
        }
    } catch { }

    try {
        const el = document.createElement('textarea');
        el.value = value;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        el.style.top = '0';
        document.body.appendChild(el);
        el.select();
        el.setSelectionRange(0, el.value.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(el);
        return !!ok;
    } catch {
        return false;
    }
}

function getPriceHistoryPeak(car) {
    const history = car?.priceHistory;
    if (!Array.isArray(history) || history.length === 0) return null;
    let peak = null;
    for (const entry of history) {
        const price = Number(entry?.price || 0);
        if (!price || price <= 0) continue;
        if (peak == null || price > peak) peak = price;
    }
    return peak;
}

function refreshPulseFromData() {
    if (!Array.isArray(allCars) || allCars.length === 0) {
        updatePulseCount();
        return;
    }

    const lastPrices = loadStoredJson(PULSE_LAST_PRICE_KEY, {});
    const trackedIds = new Set();

    for (const id of favorites) trackedIds.add(String(id));
    for (const id of compare) trackedIds.add(String(id));
    for (const id of sharedShortlistIds) trackedIds.add(String(id));

    const priceDrops = [];
    const priceIncreases = [];

    for (const id of trackedIds) {
        const car = allCars.find(c => String(c.id) === String(id));
        if (!car) continue;

        const currentPrice = Number(car.price || 0);
        if (!currentPrice || currentPrice <= 0) continue;

        const historyPeak = getPriceHistoryPeak(car);
        const storedPrevious = lastPrices?.[id] != null ? Number(lastPrices[id]) : null;
        const previousPrice = (historyPeak != null && historyPeak > currentPrice)
            ? historyPeak
            : (storedPrevious != null && !Number.isNaN(storedPrevious) && storedPrevious > 0 ? storedPrevious : null);

        if (previousPrice != null && previousPrice !== currentPrice) {
            const delta = previousPrice - currentPrice;
            if (delta > 0) {
                priceDrops.push({ id, from: previousPrice, to: currentPrice, delta, ts: Date.now() });
            } else if (delta < 0) {
                priceIncreases.push({ id, from: previousPrice, to: currentPrice, delta: Math.abs(delta), ts: Date.now() });
            }
        }

        lastPrices[id] = currentPrice;
    }

    pulseState = {
        newListings: [],
        priceDrops: priceDrops.sort((a, b) => b.delta - a.delta).slice(0, 20),
        priceIncreases: priceIncreases.sort((a, b) => b.delta - a.delta).slice(0, 20),
        ts: Date.now()
    };

    persistStoredJson(PULSE_LAST_PRICE_KEY, lastPrices);
    persistStoredJson(PULSE_STATE_KEY, pulseState);
    updatePulseCount();
}

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    pulseState = loadStoredJson(PULSE_STATE_KEY, pulseState);
    hydrateFromUrlParams();
    setupEventListeners();
    setupHeaderScroll();
    setupInfiniteScroll();
    await loadCars();
    syncPersonaUI();
    updateSavedCount();
    updateCompareCount();
    refreshPulseFromData();
    if (pendingBriefCarId) {
        const id = pendingBriefCarId;
        pendingBriefCarId = null;
        try { sessionStorage.removeItem('pendingBriefCarId'); } catch { }
        openDealBrief(id);
    }
}

function hydrateFromUrlParams() {
    try {
        const params = new URLSearchParams(window.location.search || '');
        const q = (params.get('q') || params.get('query') || params.get('search') || '').trim();
        const persona = (params.get('persona') || '').trim();
        const body = (params.get('body') || '').trim();
        const sort = (params.get('sort') || '').trim();
        const shortlistRaw = (params.get('shortlist') || '').trim();
        const briefRaw = (params.get('brief') || params.get('dealBrief') || '').trim();

        if (q && searchInput) searchInput.value = q;
        if (sort && sortSelect) sortSelect.value = sort;

        if (persona) {
            currentPersona = persona;
            localStorage.setItem('persona', currentPersona);
        }

        if (body && filterBody) {
            filterBody.value = body;
            const pills = document.querySelectorAll('.cat-pill');
            pills.forEach(p => p.classList.remove('active'));
            for (const pill of pills) {
                const label = pill.querySelector('.cat-pill-label')?.innerText || '';
                if (body === '' && label === 'All') pill.classList.add('active');
                if (body !== '' && label.toLowerCase().includes(body.toLowerCase())) pill.classList.add('active');
            }
            if (body === '' && pills.length > 0) pills[0].classList.add('active');
        }

        if (shortlistRaw) {
            const ids = shortlistRaw.split(',').map(s => s.trim()).filter(Boolean);
            sharedShortlistIds = ids;
            sessionStorage.setItem('sharedShortlistIds', JSON.stringify(ids));
            aiLensExpanded = true;
            sessionStorage.setItem('aiLensExpanded', '1');
            refreshPulseFromData();

            params.delete('shortlist');
            const next = params.toString();
            const url = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`;
            window.history.replaceState({}, document.title, url);
        } else {
            try {
                const saved = JSON.parse(sessionStorage.getItem('sharedShortlistIds') || '[]');
                if (Array.isArray(saved)) sharedShortlistIds = saved;
            } catch { }
        }

        if (briefRaw) {
            pendingBriefCarId = briefRaw;
            try { sessionStorage.setItem('pendingBriefCarId', briefRaw); } catch { }

            params.delete('brief');
            params.delete('dealBrief');
            const next = params.toString();
            const url = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`;
            window.history.replaceState({}, document.title, url);
        } else {
            try {
                const savedBrief = sessionStorage.getItem('pendingBriefCarId');
                if (savedBrief) pendingBriefCarId = savedBrief;
            } catch { }
        }
    } catch {
        return;
    }
}

function setupEventListeners() {
    filterMake.addEventListener('change', () => { populateModels(); applyFilters(); });
    filterModel.addEventListener('change', applyFilters);
    filterYear.addEventListener('change', applyFilters);
    filterPrice.addEventListener('change', applyFilters);
    filterBody.addEventListener('change', applyFilters);
    sortSelect.addEventListener('change', applyFilters);
    searchBtn.addEventListener('click', applyFilters);
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') applyFilters(); });

    filterTags.forEach(tag => {
        tag.addEventListener('click', () => {
            filterTags.forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            applyFilters();
        });
    });

    if (aiBriefModal) {
        aiBriefModal.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.getAttribute && target.getAttribute('data-ai-modal-close') === 'true') {
                closeDealBrief();
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeDealBrief();
        });
    }

    if (aiBriefBody) {
        aiBriefBody.addEventListener('click', (e) => {
            const target = e.target?.closest?.('[data-ai-action]');
            if (!target) return;
            const action = target.getAttribute('data-ai-action');
            const carId = target.getAttribute('data-ai-car-id') || currentBriefCarId;
            if (!action || !carId) return;

            if (action === 'save') {
                toggleFavoriteById(carId);
                renderDealBrief(carId);
                return;
            }
            if (action === 'compare') {
                toggleCompare(carId);
                renderDealBrief(carId);
                return;
            }
            if (action === 'brief') {
                renderDealBrief(carId);
                return;
            }
            if (action === 'copy-brief-link') {
                const link = buildBriefLink(carId);
                copyTextToClipboard(link).then((ok) => {
                    showToast(ok ? 'Brief link copied' : 'Could not copy link', ok ? 'success' : 'error');
                });
                return;
            }
            if (action === 'copy-negotiation') {
                const text = (briefCopyState?.carId === String(carId)) ? briefCopyState.negotiationText : '';
                copyTextToClipboard(text).then((ok) => {
                    showToast(ok ? 'Offer text copied' : 'Could not copy offer text', ok ? 'success' : 'error');
                });
                return;
            }
            if (action === 'copy-questions') {
                const text = (briefCopyState?.carId === String(carId)) ? briefCopyState.questionsText : '';
                copyTextToClipboard(text).then((ok) => {
                    showToast(ok ? 'Questions copied' : 'Could not copy questions', ok ? 'success' : 'error');
                });
                return;
            }
            if (action === 'view') {
                window.location.href = `details.html?id=${carId}`;
                return;
            }
        });
    }

    bindAiQueryChips(document);

    const setFiltersOpen = (open) => {
        if (!filtersPanel) return;
        const shouldOpen = Boolean(open);
        filtersPanel.classList.toggle('open', shouldOpen);
        filtersPanel.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
        if (filtersToggleBtn) {
            filtersToggleBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
            filtersToggleBtn.textContent = shouldOpen ? 'Close' : 'Filters';
        }
    };

    const mq = window.matchMedia ? window.matchMedia('(min-width: 1025px)') : null;
    if (mq) {
        setFiltersOpen(mq.matches);
        const onChange = (e) => setFiltersOpen(e.matches);
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    }

    if (filtersToggleBtn && filtersPanel) {
        filtersToggleBtn.addEventListener('click', () => {
            const isHidden = filtersPanel.getAttribute('aria-hidden') !== 'false';
            setFiltersOpen(isHidden);
        });
    }

    if (filtersCloseBtn && filtersPanel) {
        filtersCloseBtn.addEventListener('click', () => setFiltersOpen(false));
    }

    if (filtersPanel) {
        filtersPanel.addEventListener('click', (e) => {
            const target = e.target?.closest?.('.cat-pill, .persona-pill');
            if (!target) return;
            setTimeout(() => setFiltersOpen(false), 0);
        });
    }

    if (aiLens) {
        aiLens.addEventListener('click', (e) => {
            const btn = e.target?.closest?.('[data-ai-lens-action]');
            const action = btn?.getAttribute?.('data-ai-lens-action');
            if (!action) return;

            if (action === 'reset') {
                clearAllFilters();
                return;
            }

            if (action === 'edit') {
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select?.();
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (action === 'toggle') {
                aiLensExpanded = !aiLensExpanded;
                sessionStorage.setItem('aiLensExpanded', aiLensExpanded ? '1' : '0');
                updateAiLens(lastNlSearch || parseNaturalLanguageSearch(lastRawSearch || ''), lastRawSearch || '');
                if (aiLensExpanded) {
                    const details = document.querySelector('.ai-search-details');
                    if (details) details.open = true;
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (action === 'save-all') {
                const top = filteredCars.slice(0, 5);
                top.forEach((c) => {
                    const id = c?.id;
                    if (id == null) return;
                    const key = Number.isNaN(Number(id)) ? String(id) : Number(id);
                    if (!favorites.has(key)) toggleFavoriteById(id);
                });
                updateAiLens(lastNlSearch || parseNaturalLanguageSearch(lastRawSearch || ''), lastRawSearch || '');
                return;
            }

            if (action === 'save-one') {
                const carId = btn.getAttribute('data-ai-car-id');
                if (!carId) return;
                toggleFavoriteById(carId);
                updateAiLens(lastNlSearch || parseNaturalLanguageSearch(lastRawSearch || ''), lastRawSearch || '');
                return;
            }

            if (action === 'view') {
                const carId = btn.getAttribute('data-ai-car-id');
                if (!carId) return;
                window.location.href = `details.html?id=${carId}`;
                return;
            }

            if (action === 'brief') {
                const carId = btn.getAttribute('data-ai-car-id');
                if (!carId) return;
                openDealBrief(carId);
                return;
            }

            if (action === 'share-shortlist') {
                const ids = (Array.isArray(sharedShortlistIds) && sharedShortlistIds.length)
                    ? sharedShortlistIds
                    : (favorites.size ? [...favorites] : filteredCars.slice(0, 5).map(c => c?.id));

                const link = buildShortlistLink(ids);
                if (!link) {
                    showToast('Nothing to share yet', 'info', 2000);
                    return;
                }

                copyTextToClipboard(link).then((ok) => {
                    if (ok) showToast('Shortlist link copied', 'success', 2200);
                    else window.prompt('Copy this link:', link);
                });

                return;
            }

            if (action === 'save-shared') {
                if (!Array.isArray(sharedShortlistIds) || sharedShortlistIds.length === 0) {
                    showToast('No shared shortlist active', 'info', 2000);
                    return;
                }
                for (const id of sharedShortlistIds.slice(0, 60)) {
                    const key = Number.isNaN(Number(id)) ? String(id) : Number(id);
                    if (!favorites.has(key)) toggleFavoriteById(id);
                }
                showToast('Shared shortlist saved', 'success', 2200);
                updateAiLens(lastNlSearch || parseNaturalLanguageSearch(lastRawSearch || ''), lastRawSearch || '');
                return;
            }

            if (action === 'clear-shared') {
                sharedShortlistIds = [];
                try { sessionStorage.removeItem('sharedShortlistIds'); } catch { }
                refreshPulseFromData();
                showToast('Shared shortlist cleared', 'info', 2000);
                updateAiLens(lastNlSearch || parseNaturalLanguageSearch(lastRawSearch || ''), lastRawSearch || '');
            }
        });
    }

    const headerNav = document.querySelector('.header-nav');
    if (headerNav) {
        headerNav.addEventListener('click', (e) => {
            const btn = e.target?.closest?.('[data-ai-nav]');
            const action = btn?.getAttribute?.('data-ai-nav');
            if (!action) return;

            const links = headerNav.querySelectorAll('.header-nav-link');
            links.forEach(l => l.classList.remove('active'));
            btn.classList.add('active');

            if (action === 'new') {
                if (searchInput) searchInput.value = 'newish';
                applyFilters();
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (action === 'used') {
                if (searchInput) searchInput.value = '';
                selectPersona('all');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (action === 'ev') {
                if (searchInput) searchInput.value = 'electric great deal';
                selectPersona('ev');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (action === 'research') {
                aiLensExpanded = true;
                sessionStorage.setItem('aiLensExpanded', '1');
                updateAiLens(lastNlSearch || parseNaturalLanguageSearch(lastRawSearch || ''), lastRawSearch || '');
                const details = document.querySelector('.ai-search-details');
                if (details) details.open = true;
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if (action === 'shortlist') {
                aiLensExpanded = true;
                sessionStorage.setItem('aiLensExpanded', '1');
                updateAiLens(lastNlSearch || parseNaturalLanguageSearch(lastRawSearch || ''), lastRawSearch || '');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!filtersPanel) return;
        if (filtersPanel.getAttribute('aria-hidden') === 'false') setFiltersOpen(false);
    });

    if (savedBtn) savedBtn.addEventListener('click', openSaved);
    if (headerSavedBtn) headerSavedBtn.addEventListener('click', openSaved);
    if (pulseBtn) pulseBtn.addEventListener('click', openPulse);
    if (compareBtn) compareBtn.addEventListener('click', openCompare);
    if (resetBtn) resetBtn.addEventListener('click', clearAllFilters);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearAllFilters);

    if (savedModal) {
        savedModal.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.getAttribute && target.getAttribute('data-ai-modal-close') === 'true') {
                closeSaved();
            }
        });
    }

    if (compareModal) {
        compareModal.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.getAttribute && target.getAttribute('data-ai-modal-close') === 'true') {
                closeCompare();
            }
        });
    }

    if (pulseBody) {
        pulseBody.addEventListener('click', (e) => {
            const target = e.target?.closest?.('[data-ai-action]');
            if (!target) return;
            const action = target.getAttribute('data-ai-action');
            const carId = target.getAttribute('data-ai-car-id');
            if (!action || !carId) return;

            if (action === 'brief') {
                closePulse();
                openDealBrief(carId);
                return;
            }

            if (action === 'view') {
                window.location.href = `details.html?id=${carId}`;
            }
        });
    }

    if (pulseModal) {
        pulseModal.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.getAttribute && target.getAttribute('data-ai-modal-close') === 'true') {
                closePulse();
            }
        });
    }
}

function setupHeaderScroll() {
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        if (!header) return;
        header.classList.toggle('scrolled', window.scrollY > 50);
    });
}

// Optimized Infinite Scroll using IntersectionObserver
function setupInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoading && displayedCount < filteredCars.length) {
            loadMoreCars();
        }
    }, {
        rootMargin: '200px',
        threshold: 0
    });

    if (scrollLoader) {
        observer.observe(scrollLoader);
    }
}

async function loadCars() {
    try {
        if (loading) loading.style.display = 'block';
        const response = await fetch('cars.json');
        if (!response.ok) throw new Error('Failed to load cars');
        const rawData = await response.json();

        allCars = rawData.map((car, i) => normalizeCar(car, i));
        filteredCars = [...allCars];

        populateFilters();
        updateStats();
        applyFilters();

        if (loading) loading.style.display = 'none';
        updateSavedCount();
        updateCompareCount();
    } catch (error) {
        console.error('Error loading cars:', error);
        if (loading) {
            loading.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><h3 class="empty-title">Error Loading Cars</h3><p class="empty-subtitle">Please run: python max_scraper.py</p></div>';
        }
    }
}

function normalizeCar(raw, index) {
    const isCarGurus = raw.listingTitle || raw.makeName;

    if (isCarGurus) {
        return {
            id: raw.id || index,
            year: raw.carYear || 2020,
            make: raw.makeName || 'Unknown',
            model: raw.modelName || 'Unknown',
            trim: raw.trimName || '',
            price: raw.price || 0,
            mileage: raw.mileage || 0,
            exteriorColor: raw.localizedExteriorColor || raw.exteriorColorName || 'Unknown',
            interiorColor: raw.localizedInteriorColor || raw.interiorColor || 'Unknown',
            transmission: raw.localizedTransmission || 'Automatic',
            fuelType: raw.localizedFuelType || 'Gasoline',
            drivetrain: raw.localizedDriveTrain || raw.driveTrain || 'FWD',
            bodyType: raw.bodyTypeName || 'Sedan',
            imageUrl: raw.originalPictureData?.url || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800',
            dealRating: formatDealRating(raw.dealRating),
            dealScore: raw.dealScore || 0,
            priceDifferential: raw.priceDifferential || 0,
            dealer: {
                name: raw.serviceProviderName || raw.dealerName || 'Local Dealer',
                rating: raw.sellerRating || 4.0,
                reviews: raw.reviewCount || 0,
                phone: raw.phoneNumberString || ''
            },
            location: {
                city: raw.sellerCity || 'Houston, TX',
                state: raw.sellerRegion || 'TX',
                zip: raw.sellerPostalCode || '77479',
                distance: raw.distance || 0
            },
            features: raw.options || [],
            vin: raw.vin || '',
            stockNumber: raw.stockNumber || '',
            daysOnMarket: raw.daysOnMarket || 0
        };
    }
    return raw;
}

function formatDealRating(rating) {
    if (!rating) return 'No Price Analysis';
    const map = {
        'GREAT_PRICE': 'Great Deal',
        'GOOD_PRICE': 'Good Deal',
        'FAIR_PRICE': 'Fair Deal',
        'HIGH_PRICE': 'High Price',
        'OVERPRICED': 'Overpriced'
    };
    return map[rating] || rating.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}
function formatCurrencyWhole(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function populateFilters() {
    const makes = [...new Set(allCars.map(c => c.make))].sort();
    filterMake.innerHTML = '<option value="">All Makes</option>' + makes.map(m => `<option value="${m}">${m}</option>`).join('');

    const years = [...new Set(allCars.map(c => c.year))].sort((a, b) => b - a);
    filterYear.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
}

function populateModels() {
    const selectedMake = filterMake.value;
    if (!selectedMake) {
        filterModel.innerHTML = '<option value="">All Models</option>';
        return;
    }
    const models = [...new Set(allCars.filter(c => c.make === selectedMake).map(c => c.model))].sort();
    filterModel.innerHTML = '<option value="">All Models</option>' + models.map(m => `<option value="${m}">${m}</option>`).join('');
}

function updateStats() {
    if (totalCarsEl) {
        totalCarsEl.textContent = allCars.length.toLocaleString();
    }
}


// Parse natural language search queries like "5k down", "under 20000", "BMW SUV"
function parseNaturalLanguageSearch(query) {
    const result = {
        maxDownPayment: null,
        maxPrice: null,
        minPrice: null,
        maxMonthly: null,
        minMonthly: null,
        minYear: null,
        maxMileage: null,
        keywords: []
    };

    if (!query) return result;

    let lowerQuery = query.toLowerCase().trim();

    // V2: Smart Keywords
    if (lowerQuery.includes('newish') || lowerQuery.includes('modern')) {
        result.minYear = new Date().getFullYear() - 4; // Last 4 years
        lowerQuery = lowerQuery.replace('newish', '').replace('modern', '');
    }

    if (lowerQuery.includes('low miles') || lowerQuery.includes('low mileage')) {
        result.maxMileage = 35000;
        lowerQuery = lowerQuery.replace('low miles', '').replace('low mileage', '');
    }

    if (lowerQuery.includes('cheap') || lowerQuery.includes('budget')) {
        result.maxPrice = 15000;
        lowerQuery = lowerQuery.replace('cheap', '').replace('budget', '');
    }

    // Match down payment patterns: "5k down", "5000 down", "$5,000 down"
    const downPaymentMatch = lowerQuery.match(/(\$?\d+[,.]?\d*k?)\s*down/i);
    if (downPaymentMatch) {
        let amount = downPaymentMatch[1].replace(/[$,]/g, '');
        if (amount.endsWith('k')) {
            amount = parseFloat(amount) * 1000;
        } else {
            amount = parseFloat(amount);
        }
        result.maxDownPayment = amount;
    }

    // Match monthly payment patterns FIRST (to avoid confusion with total price)
    // "under 400/mo", "below $500 monthly"
    const underMonthlyMatch = lowerQuery.match(/(under|below|less\s*than|max)\s*\$?(\d+[,.]?\d*k?)\s*(\/mo|mo|per\s*month|monthly)/i);
    if (underMonthlyMatch) {
        let amount = underMonthlyMatch[2].replace(/[$,]/g, '');
        if (amount.endsWith('k')) {
            amount = parseFloat(amount) * 1000;
        } else {
            amount = parseFloat(amount);
        }
        result.maxMonthly = amount;
        // Clean up the string so we don't match this as a price later
        lowerQuery = lowerQuery.replace(underMonthlyMatch[0], '');
    }

    const overMonthlyMatch = lowerQuery.match(/(over|above|more\s*than|min)\s*\$?(\d+[,.]?\d*k?)\s*(\/mo|mo|per\s*month|monthly)/i);
    if (overMonthlyMatch) {
        let amount = overMonthlyMatch[2].replace(/[$,]/g, '');
        if (amount.endsWith('k')) {
            amount = parseFloat(amount) * 1000;
        } else {
            amount = parseFloat(amount);
        }
        result.minMonthly = amount;
        lowerQuery = lowerQuery.replace(overMonthlyMatch[0], '');
    }

    // Match price patterns: "under 20000", "below $30k", "less than 25000"
    const underPriceMatch = lowerQuery.match(/(under|below|less\s*than|max)\s*\$?(\d+[,.]?\d*k?)/i);
    if (underPriceMatch) {
        let amount = underPriceMatch[2].replace(/[$,]/g, '');
        if (amount.endsWith('k')) {
            amount = parseFloat(amount) * 1000;
        } else {
            amount = parseFloat(amount);
        }
        result.maxPrice = amount; // Overwrite 'cheap' if specific price given
    }

    // Match "over/above X" patterns
    const overPriceMatch = lowerQuery.match(/(over|above|more\s*than|min)\s*\$?(\d+[,.]?\d*k?)/i);
    if (overPriceMatch) {
        let amount = overPriceMatch[2].replace(/[$,]/g, '');
        if (amount.endsWith('k')) {
            amount = parseFloat(amount) * 1000;
        } else {
            amount = parseFloat(amount);
        }
        result.minPrice = amount;
    }

    // Extract remaining keywords (remove matched patterns)
    let cleanQuery = lowerQuery
        .replace(/(\$?\d+[,.]?\d*k?)\s*down/gi, '')
        .replace(/(under|below|less\s*than|max|over|above|more\s*than|min)\s*\$?(\d+[,.]?\d*k?)/gi, '')
        .trim();

    if (cleanQuery) {
        result.keywords = cleanQuery.split(/\s+/).filter(w => w.length > 1);
    }

    return result;
}

function bindAiQueryChips(root) {
    const scope = root || document;
    const queryChips = scope.querySelectorAll('.ai-query-chip');
    queryChips.forEach((chip) => {
        if (chip.dataset.aiBound === '1') return;
        chip.dataset.aiBound = '1';
        chip.addEventListener('click', () => {
            const q = chip.getAttribute('data-ai-query') || chip.textContent || '';
            if (searchInput) searchInput.value = q.trim();
            applyFilters();
        });
    });
}

function formatCompactMoney(amount) {
    const n = Number(amount || 0);
    if (!Number.isFinite(n) || n <= 0) return '';
    if (n >= 10000) return `${Math.round(n / 1000)}k`;
    return `${Math.round(n)}`;
}

function computeMedian(values) {
    const nums = (values || []).filter(v => Number.isFinite(v)).slice().sort((a, b) => a - b);
    if (nums.length === 0) return null;
    const mid = Math.floor(nums.length / 2);
    return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function buildAISearchSuggestions(nlSearch, rawSearch, count, medianPrice, medianMiles, medianYear) {
    const suggestions = [];

    const pushSuggestion = (q) => {
        const s = String(q || '').trim();
        if (!s) return;
        const key = s.toLowerCase();
        if (suggestions.some(x => x.toLowerCase() === key)) return;
        suggestions.push(s);
    };

    if (count === 0) {
        if (nlSearch?.maxPrice) pushSuggestion(`under ${formatCompactMoney(nlSearch.maxPrice + 5000)}`);
        if (nlSearch?.minYear) pushSuggestion(`${Math.max(2015, nlSearch.minYear - 2)}+`);
        if (nlSearch?.maxMileage) pushSuggestion(`under ${Math.round((nlSearch.maxMileage + 20000) / 1000)}k miles`);
        if (!rawSearch?.trim()) pushSuggestion('great deal');
    } else if (count < 12) {
        if (nlSearch?.maxPrice) pushSuggestion(`under ${formatCompactMoney(nlSearch.maxPrice + 5000)}`);
        if (!nlSearch?.maxPrice && medianPrice) pushSuggestion(`under ${formatCompactMoney(medianPrice * 1.15)}`);
        if (!nlSearch?.maxMileage) pushSuggestion('low miles');
        if (!nlSearch?.minYear) pushSuggestion('newish');
    } else if (count > 120) {
        if (!nlSearch?.maxPrice && medianPrice) pushSuggestion(`under ${formatCompactMoney(medianPrice)}`);
        if (!nlSearch?.maxMileage && medianMiles) pushSuggestion(`under ${Math.round(medianMiles / 1000)}k miles`);
        if (!nlSearch?.minYear && medianYear) pushSuggestion(`${Math.round(medianYear)}+`);
        pushSuggestion('great deal');
    } else {
        if (!nlSearch?.maxPrice && medianPrice) pushSuggestion(`under ${formatCompactMoney(medianPrice)}`);
        if (!nlSearch?.minYear && medianYear) pushSuggestion('newish');
        if (!nlSearch?.maxMileage && medianMiles) pushSuggestion('low miles');
    }

    const label = count === 0
        ? 'No matches — try:'
        : count < 12
            ? 'Few matches — try:'
            : count > 120
                ? 'Too many matches — try:'
                : 'Try:';

    return { label, suggestions };
}

function updateAISearchCoach(nlSearch, rawSearch) {
    const hint = document.querySelector('.ai-search-hint');
    if (!hint) return;

    const count = filteredCars.length;
    const prices = filteredCars.map(c => Number(c.price || 0)).filter(v => v > 0);
    const miles = filteredCars.map(c => Number(c.mileage || 0)).filter(v => v > 0);
    const years = filteredCars.map(c => Number(c.year || c.carYear || 0)).filter(v => v > 0);
    const medianPrice = computeMedian(prices);
    const medianMiles = computeMedian(miles);
    const medianYear = computeMedian(years);

    const { label, suggestions } = buildAISearchSuggestions(nlSearch, rawSearch, count, medianPrice, medianMiles, medianYear);

    const chipHtml = suggestions.slice(0, 4).map((q) => (
        `<button type="button" class="ai-query-chip" data-ai-query="${escapeHtml(q)}">${escapeHtml(q)}</button>`
    )).join('');

    hint.innerHTML = `<span style="white-space:nowrap;">AI Coach:</span> <span style="white-space:nowrap;">${escapeHtml(label)}</span> ${chipHtml}`;
    bindAiQueryChips(hint);
}

function formatPersonaLabel(persona) {
    const p = String(persona || 'all').toLowerCase().trim();
    if (p === 'all') return 'Top deals';
    if (p === 'commuter') return 'Commuter';
    if (p === 'family') return 'Family';
    if (p === 'roadtrip') return 'Road trip';
    if (p === 'performance') return 'Performance';
    if (p === 'ev') return 'EV-first';
    if (p === 'budget') return 'Budget';
    return p;
}

function updateAiLens(nlSearch, rawSearch) {
    if (!aiLens) return;

    const count = filteredCars.length;
    const prices = filteredCars.map(c => Number(c.price || 0)).filter(v => v > 0);
    const miles = filteredCars.map(c => Number(c.mileage || 0)).filter(v => v > 0);
    const years = filteredCars.map(c => Number(c.year || c.carYear || 0)).filter(v => v > 0);
    const medianPrice = computeMedian(prices);
    const medianMiles = computeMedian(miles);
    const medianYear = computeMedian(years);
    const { suggestions } = buildAISearchSuggestions(nlSearch, rawSearch, count, medianPrice, medianMiles, medianYear);

    const chips = [];
    const addChip = (label) => {
        const s = String(label || '').trim();
        if (!s) return;
        chips.push(s);
    };

    addChip(formatPersonaLabel(currentPersona));

    if (filterBody?.value) addChip(filterBody.value);
    if (nlSearch?.maxPrice) addChip(`Under $${Number(nlSearch.maxPrice).toLocaleString()}`);
    if (nlSearch?.minPrice) addChip(`Over $${Number(nlSearch.minPrice).toLocaleString()}`);
    if (nlSearch?.maxMonthly) addChip(`Under $${Number(nlSearch.maxMonthly).toLocaleString()}/mo`);
    if (nlSearch?.minYear) addChip(`${Number(nlSearch.minYear)}+`);
    if (nlSearch?.maxMileage) addChip(`Under ${Math.round(Number(nlSearch.maxMileage) / 1000)}k mi`);

    const kw = (nlSearch?.keywords || []).filter(Boolean);
    if (kw.length && String(rawSearch || '').length <= 40) addChip(kw.slice(0, 2).join(' '));

    const summary = count === 0
        ? 'No matches'
        : count === 1
            ? '1 match'
            : `${count.toLocaleString()} matches`;

    const chipHtml = chips.slice(0, 4).map(c => `<span class="ai-lens-chip">${escapeHtml(c)}</span>`).join('');

    const rankingLine = currentPersona === 'all'
        ? 'Ranking: deal score first, then affordability + signals'
        : 'Ranking: persona fit first, then deal score';

    const parsedParts = [];
    if (filterBody?.value) parsedParts.push(filterBody.value);
    if (nlSearch?.maxPrice) parsedParts.push(`under $${Number(nlSearch.maxPrice).toLocaleString()}`);
    if (nlSearch?.minPrice) parsedParts.push(`over $${Number(nlSearch.minPrice).toLocaleString()}`);
    if (nlSearch?.maxMonthly) parsedParts.push(`under $${Number(nlSearch.maxMonthly).toLocaleString()}/mo`);
    if (nlSearch?.minYear) parsedParts.push(`${Number(nlSearch.minYear)}+`);
    if (nlSearch?.maxMileage) parsedParts.push(`under ${Math.round(Number(nlSearch.maxMileage) / 1000)}k mi`);
    const kwText = (nlSearch?.keywords || []).filter(Boolean).slice(0, 5).join(' ');
    if (kwText) parsedParts.push(kwText);

    const interpreted = parsedParts.length ? parsedParts.join(' • ') : 'No explicit constraints detected';

    const refineHtml = suggestions.slice(0, 4).map((q) => (
        `<button type="button" class="ai-lens-refine-chip ai-query-chip" data-ai-query="${escapeHtml(q)}">${escapeHtml(q)}</button>`
    )).join('');

    const sharedActive = Array.isArray(sharedShortlistIds) && sharedShortlistIds.length > 0;
    const sharedSummary = sharedActive ? 'shared shortlist active' : 'ranked by fit + value';

    const sharedHtml = sharedActive ? `
      <div class="ai-lens-explain">
        <div class="ai-lens-explain-title">Shared shortlist</div>
        <div class="ai-lens-explain-text">${sharedShortlistIds.length.toLocaleString()} cars from a shared link are being tracked.</div>
        <div class="ai-lens-actions" style="justify-content:flex-start; padding: 10px 0 0;">
          <button type="button" class="ai-lens-btn" data-ai-lens-action="save-shared">Save all</button>
          <button type="button" class="ai-lens-btn secondary" data-ai-lens-action="clear-shared">Clear</button>
        </div>
      </div>
    ` : '';

    const expandedHtml = aiLensExpanded ? `
      <div class="ai-lens-expand">
        ${sharedHtml}
        <div class="ai-lens-explain">
          <div class="ai-lens-explain-title">What the AI is doing</div>
          <div class="ai-lens-explain-text">${escapeHtml(rankingLine)}</div>
          <div class="ai-lens-explain-text">Interpreted as: ${escapeHtml(interpreted)}</div>
        </div>
        ${suggestions.length ? `
          <div class="ai-lens-refine">
            <div class="ai-lens-refine-title">Refine in one tap</div>
            <div class="ai-lens-refine-chips">${refineHtml}</div>
          </div>
        ` : ''}
        <div class="ai-lens-shortlist">
          <div class="ai-lens-shortlist-top">
            <div class="ai-lens-shortlist-title">AI Shortlist</div>
            <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;">
              <button type="button" class="ai-lens-btn" data-ai-lens-action="share-shortlist">Copy link</button>
              <button type="button" class="ai-lens-btn" data-ai-lens-action="save-all">Save top 5</button>
            </div>
          </div>
          <div class="ai-lens-shortlist-note">Top picks for your current lens, with quick actions.</div>
          <div class="ai-lens-shortlist-rows">
            ${filteredCars.slice(0, 5).map((c) => {
                const title = escapeHtml(`${c.year || ''} ${c.make || ''} ${c.model || ''}`.trim());
                const meta = escapeHtml(`${Math.round(Number(c.mileage || 0) / 1000)}k miles • $${Number(c.price || 0).toLocaleString()}`);
                const img = escapeHtml(c.imageUrl || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800');
                const diff = c.priceDifferential != null && !Number.isNaN(Number(c.priceDifferential)) ? Number(c.priceDifferential) : null;
                const deal = escapeHtml(formatDealRating(c.dealRating) || 'No Price Analysis');
                const persona = currentPersona !== 'all' ? getPersonaMatch(c) : null;
                const reasons = [];
                if (persona) reasons.push(`${formatPersonaLabel(currentPersona)} match ${persona.score}`);
                if (deal && deal !== 'No Price Analysis') reasons.push(deal);
                if (diff != null && diff > 0) reasons.push(`${money(Math.round(diff))} below market`);
                if (diff != null && diff < 0) reasons.push(`${money(Math.abs(Math.round(diff)))} above market`);
                const savedKey = Number.isNaN(Number(c.id)) ? String(c.id) : Number(c.id);
                const isSaved = favorites.has(savedKey);
                const reasonsHtml = reasons.length
                    ? `<div class="match-reasons">${reasons.slice(0, 2).map(r => `<span class="match-reason-pill">${escapeHtml(r)}</span>`).join('')}</div>`
                    : '';
                return `
                  <div class="saved-row">
                    <div class="saved-thumb"><img src="${img}" alt="${title}" loading="lazy" referrerpolicy="no-referrer" crossorigin="anonymous"></div>
                    <div>
                      <div class="saved-title">${title}</div>
                      <div class="saved-meta">${meta}</div>
                      ${reasonsHtml}
                    </div>
                    <div class="saved-actions">
                      <button type="button" class="saved-action" data-ai-lens-action="save-one" data-ai-car-id="${escapeHtml(String(c.id))}">${isSaved ? 'Saved' : 'Save'}</button>
                      <button type="button" class="saved-action" data-ai-lens-action="brief" data-ai-car-id="${escapeHtml(String(c.id))}">Brief</button>
                      <button type="button" class="saved-action" data-ai-lens-action="view" data-ai-car-id="${escapeHtml(String(c.id))}">View</button>
                    </div>
                  </div>
                `;
            }).join('')}
          </div>
        </div>
      </div>
    ` : '';

    aiLens.innerHTML = `
      <div class="ai-lens-left">
        <button type="button" class="ai-lens-title-btn" data-ai-lens-action="toggle">AI Lens</button>
        <button type="button" class="ai-lens-meta-btn" data-ai-lens-action="toggle">${escapeHtml(summary)} • ${escapeHtml(sharedSummary)}</button>
      </div>
      <div class="ai-lens-chips">${chipHtml}</div>
      <div class="ai-lens-actions">
        <button type="button" class="ai-lens-btn" data-ai-lens-action="toggle">${aiLensExpanded ? 'Hide' : 'Why?'}</button>
        <button type="button" class="ai-lens-btn" data-ai-lens-action="edit">Edit</button>
        <button type="button" class="ai-lens-btn secondary" data-ai-lens-action="reset">Reset</button>
      </div>
      ${expandedHtml}
    `;

    bindAiQueryChips(aiLens);
}

function applyFilters() {
    // Smooth transition for filter changes
    if (carGrid) {
        carGrid.style.opacity = '0.4';
        carGrid.style.transition = 'opacity 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    }
    
    const make = filterMake.value;
    const model = filterModel.value;
    const year = filterYear.value;
    const priceRange = filterPrice.value;
    const body = filterBody.value;
    const rawSearch = searchInput.value;
    const activeTag = document.querySelector('.filter-tag.active')?.dataset.filter || 'all';
    const sort = sortSelect.value;

    // Parse natural language search
    const nlSearch = parseNaturalLanguageSearch(rawSearch);
    lastNlSearch = nlSearch;
    lastRawSearch = rawSearch;
    const searchKeywords = nlSearch.keywords.join(' ').toLowerCase();

    filteredCars = allCars.filter(car => {
        if (make && car.make !== make) return false;
        if (model && car.model !== model) return false;
        if (year && car.year !== parseInt(year)) return false;
        if (body && !car.bodyType.toLowerCase().includes(body.toLowerCase())) return false;

        if (priceRange) {
            const [min, max] = priceRange.split('-').map(Number);
            if (car.price < min || car.price > max) return false;
        }

        // Natural language down payment filter
        if (nlSearch.maxDownPayment) {
            const downPayment = car.price * DOWN_PAYMENT_PERCENT;
            if (downPayment > nlSearch.maxDownPayment) return false;
        }

        // Natural language price filters
        if (nlSearch.maxPrice && car.price > nlSearch.maxPrice) return false;
        if (nlSearch.minPrice && car.price < nlSearch.minPrice) return false;

        // V2: New filters
        if (nlSearch.minYear && car.year < nlSearch.minYear) return false;
        if (nlSearch.maxMileage && car.mileage > nlSearch.maxMileage) return false;

        if (nlSearch.maxMonthly || nlSearch.minMonthly) {
            const downPaymentAmount = Math.round(car.price * DOWN_PAYMENT_PERCENT);
            const monthlyPayment = Math.round(((car.price - downPaymentAmount) * 1.07) / 60);
            if (nlSearch.maxMonthly != null && monthlyPayment > nlSearch.maxMonthly) return false;
            if (nlSearch.minMonthly != null && monthlyPayment < nlSearch.minMonthly) return false;
        }

        // Keyword search
        if (searchKeywords) {
            const searchStr = `${car.year} ${car.make} ${car.model} ${car.trim} ${car.bodyType} ${car.fuelType}`.toLowerCase();
            if (!searchKeywords.split(' ').every(kw => searchStr.includes(kw))) return false;
        }

        if (activeTag !== 'all') {
            if (activeTag === 'Great Deal' && car.dealRating !== 'Great Deal') return false;
            if (activeTag === 'Electric' && car.fuelType !== 'Electric') return false;
            if (activeTag === 'Hybrid' && !car.fuelType.includes('Hybrid')) return false;
        }

        return true;
    });

    filteredCars.sort((a, b) => {
        const personaA = currentPersona !== 'all' ? getPersonaMatch(a).score : null;
        const personaB = currentPersona !== 'all' ? getPersonaMatch(b).score : null;

        switch (sort) {
            case 'price-asc': return a.price - b.price;
            case 'price-desc': return b.price - a.price;
            case 'mileage': return a.mileage - b.mileage;
            case 'year': return b.year - a.year;
            default:
                if (currentPersona !== 'all') {
                    const matchDiff = (personaB || 0) - (personaA || 0);
                    if (matchDiff !== 0) return matchDiff;
                }
                return (b.dealScore || 0) - (a.dealScore || 0);
        }
    });

    updateAISearchCoach(nlSearch, rawSearch);
    updateAiLens(nlSearch, rawSearch);

    // Reset and render first batch with smooth transition
    displayedCount = 0;
    
    // Fade out existing cards with scale
    const existingCards = Array.from(carGrid.children);
    existingCards.forEach((card, index) => {
        setTimeout(() => {
            card.style.transition = 'opacity 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), scale 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            card.style.opacity = '0';
            card.style.transform = 'translateY(-10px) scale(0.95)';
            setTimeout(() => {
                if (card.parentNode) card.remove();
            }, 300);
        }, index * 15);
    });

    // Clear grid after fade out and restore opacity
    setTimeout(() => {
        carGrid.innerHTML = '';
        if (carGrid) {
            carGrid.style.opacity = '1';
        }
        loadMoreCars();
        
        // Show results count toast
        if (filteredCars.length > 0) {
            showToast(`Found ${filteredCars.length.toLocaleString()} ${filteredCars.length === 1 ? 'car' : 'cars'}`, 'info', 2000);
        } else {
            showToast('No cars match your filters', 'error', 3000);
        }
    }, existingCards.length * 15 + 300);
}

function loadMoreCars() {
    if (isLoading || displayedCount >= filteredCars.length) return;

    isLoading = true;
    if (scrollLoader) scrollLoader.style.display = 'flex';

    // Use requestAnimationFrame for smooth rendering
    requestAnimationFrame(() => {
        const batch = filteredCars.slice(displayedCount, displayedCount + batchSize);
        const fragment = document.createDocumentFragment();

        batch.forEach((car, index) => {
            const article = document.createElement('article');
            article.className = 'car-card';
            article.innerHTML = createCarCardHTML(car);
            article.style.opacity = '0';
            article.style.transform = 'translateY(20px)';
            article.addEventListener('click', () => {
                window.location.href = `details.html?id=${car.id}`;
            });
            fragment.appendChild(article);
        });

        carGrid.appendChild(fragment);

        // Staggered entrance animation with scale
        const cards = Array.from(carGrid.children).slice(displayedCount);
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.style.transition = 'opacity 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), scale 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0) scale(1)';
            }, index * 40); // 40ms delay for smoother stagger
        });

        displayedCount += batch.length;

        // Update counts with smooth animation
        if (showingCount) {
            animateValue(showingCount, parseInt(showingCount.textContent.replace(/,/g, '')) || 0, displayedCount, 300);
        }
        if (totalCount) {
            animateValue(totalCount, parseInt(totalCount.textContent.replace(/,/g, '')) || 0, filteredCars.length, 300);
        }

        // Handle empty state
        if (emptyState) {
            if (filteredCars.length === 0) {
                emptyState.style.display = 'block';
                emptyState.style.animation = 'fadeIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            } else {
                emptyState.style.display = 'none';
            }
        }

        // Hide loader if no more items
        if (scrollLoader) {
            scrollLoader.style.display = (isLoading || displayedCount < filteredCars.length) ? 'flex' : 'none';
        }

        isLoading = false;
    });
}

// Smooth number animation helper
function animateValue(element, start, end, duration) {
    if (!element) return;
    const startTime = performance.now();
    const endValue = end;
    const startValue = start;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        const current = Math.round(startValue + (endValue - startValue) * easeOut);
        element.textContent = current.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = endValue.toLocaleString();
        }
    }
    
    requestAnimationFrame(update);
}

function createCarCardHTML(car) {
    const isFav = favorites.has(car.id);
    const dealClass = (car.dealRating || '').toLowerCase().replace(' ', '-');
    const match = currentPersona !== 'all' ? getPersonaMatch(car) : null;
    const isCompared = compare.has(String(car.id));

    // Down Payment Calculation (15%)
    const downPaymentAmount = Math.round(car.price * DOWN_PAYMENT_PERCENT);
    const downPaymentText = formatCurrencyWhole(downPaymentAmount);

    // Safety check for location
    const city = car.location?.city || 'Unknown';
    const state = car.location?.state || '';
    const distance = car.location?.distance ? Math.round(car.location.distance) : 0;

    // Monthly Est (Remaining balance over 60mo @ 7%)
    const monthlyPayment = Math.round(((car.price - downPaymentAmount) * 1.07) / 60);

    const reasonsHTML = (match && match.reasons && match.reasons.length > 0)
        ? `<div class="match-reasons">
             ${match.reasons.map(r => `<span class="match-reason-pill">${r}</span>`).join('')}
           </div>`
        : '';

    return `
    <div class="car-image-wrapper">
      <img src="${car.imageUrl}" alt="${car.year} ${car.make} ${car.model}" class="car-image" loading="lazy" referrerpolicy="no-referrer" crossorigin="anonymous" onload="handleCardImageLoad(this)" onerror="handleCardImageError(this)">
      
      <div class="card-badges">
         ${car.dealRating && car.dealRating !== 'No Price Analysis' ?
            `<span class="deal-badge-float ${dealClass}">${car.dealRating}</span>` : ''}
         ${match ? `<span class="deal-badge-float ai-match">Match ${match.score}</span>` : ''}
      </div>

      <button class="car-favorite ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${car.id}, this)">
        <svg viewBox="0 0 24 24" fill="${isFav ? '#ff4444' : 'none'}" stroke="${isFav ? '#ff4444' : '#ffffff'}" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>
    </div>
    <div class="car-content">
      <div class="car-header-row">
          <h3 class="car-title">${car.year} ${car.make} ${car.model}</h3>
      </div>
      <p class="car-subtitle">${car.trim || ''} • ${Math.round(car.mileage / 1000)}k miles</p>
      
      ${reasonsHTML}

      <div class="car-price-block">
        <div class="down-payment-row">
            <span class="down-price">${downPaymentText}</span>
            <span class="down-label">down</span>
        </div>
        <div class="monthly-payment-row">
            <span class="monthly-val">$${monthlyPayment}/mo</span>
            <span class="full-price-muted">Cash: $${car.price.toLocaleString()}</span>
        </div>
      </div>
      
      <div class="car-footer-row">
        <span class="car-location-sm">${city}, ${state}</span>
        <div class="car-footer-actions">
          <button class="btn-clean-action btn-ai-brief" onclick="event.stopPropagation(); openDealBrief(${car.id})">
            AI Brief
          </button>
          <button class="btn-clean-action btn-compare ${isCompared ? 'active' : ''}" onclick="event.stopPropagation(); toggleCompare(${car.id}, this)">
            ${isCompared ? 'Compared' : 'Compare'}
          </button>
          <button class="btn-clean-action" onclick="event.stopPropagation(); window.location.href='details.html?id=${car.id}'">
            View
          </button>
        </div>
      </div>
    </div>
  `;
}

function setupFavoriteButtons() {
    // Buttons are now handled inline with onclick
}

function toggleFavorite(id, btn) {
    const updated = toggleFavoriteById(id);
    if (!btn) return;
    
    // Enhanced smooth animation with Apple-style spring
    btn.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    btn.style.transform = 'scale(0.85)';
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            btn.style.transform = 'scale(1.15)';
            setTimeout(() => {
                btn.style.transform = 'scale(1)';
                setTimeout(() => {
                    btn.style.transition = '';
                }, 300);
            }, 150);
        });
    });
    
    // Update badge count with animation
    updateSavedCount();
    
    // Show toast notification
    if (updated) {
        showToast('Car saved to favorites', 'success', 2000);
        btn.classList.add('active');
        const svg = btn.querySelector('svg');
        if (svg) {
            svg.style.transition = 'fill 0.2s, stroke 0.2s';
            svg.setAttribute('fill', '#ff3b30');
            svg.setAttribute('stroke', '#ff3b30');
        }
    } else {
        showToast('Removed from favorites', 'info', 2000);
        btn.classList.remove('active');
        const svg = btn.querySelector('svg');
        if (svg) {
            svg.style.transition = 'fill 0.2s, stroke 0.2s';
            svg.setAttribute('fill', 'none');
            svg.setAttribute('stroke', '#666');
        }
    }
}

function updateSavedCount() {
    const savedCountEl = document.getElementById('header-saved-count');
    const savedCount = document.getElementById('saved-count');
    const count = favorites.size;
    
    if (savedCountEl) {
        animateValue(savedCountEl, parseInt(savedCountEl.textContent) || 0, count, 300);
    }
    if (savedCount) {
        animateValue(savedCount, parseInt(savedCount.textContent) || 0, count, 300);
    }
}

// TikTok redirect URL
const TIKTOK_URL = 'https://www.tiktok.com/@suat6690';

function openChat(carId, dealerName) {
    window.open(TIKTOK_URL, '_blank');
}


// Helper for Category Cards
function selectBodyType(type) {
    const filterBody = document.getElementById('filter-body');
    // If clicking the same type, toggle off (unless it's 'All' which is empty string)
    if (type !== '' && filterBody.value.toLowerCase().includes(type.toLowerCase())) {
        filterBody.value = '';
        document.querySelectorAll('.cat-pill').forEach(c => c.classList.remove('active'));
        // Highlight 'All'
        document.querySelectorAll('.cat-pill')[0].classList.add('active');
    } else {
        filterBody.value = type;
        document.querySelectorAll('.cat-pill').forEach(c => c.classList.remove('active'));
        // Find the button that was clicked
        const pills = document.querySelectorAll('.cat-pill');
        for (const pill of pills) {
            const label = pill.querySelector('.cat-pill-label').innerText;
            if (label.includes(type) || (type === '' && label === 'All')) {
                pill.classList.add('active');
            }
        }
    }
    applyFilters();
}

function clamp(num, min, max) {
    return Math.min(max, Math.max(min, num));
}

function normalizeText(value) {
    return String(value || '').toLowerCase();
}

function getPersonaMatch(car) {
    const persona = currentPersona || 'all';
    if (persona === 'all') return { score: 0, reasons: [] };

    const body = normalizeText(car.bodyType);
    const fuel = normalizeText(car.fuelType);
    const drivetrain = normalizeText(car.drivetrain);
    const transmission = normalizeText(car.transmission);

    const price = Number(car.price || 0);
    const mileage = Number(car.mileage || 0);
    const dealScore = car.dealScore != null ? Number(car.dealScore) : 0;
    const diff = car.priceDifferential != null ? Number(car.priceDifferential) : null;
    const days = car.daysOnMarket != null ? Number(car.daysOnMarket) : null;

    let score = 55;
    const reasons = [];

    score += clamp((dealScore || 0) * 0.35, 0, 22);
    if (dealScore >= 80) reasons.push('Great Deal');

    if (diff != null && !Number.isNaN(diff)) {
        score += clamp(diff / 600, -14, 16);
        if (diff > 1200) reasons.push('Below Market');
    }

    if (days != null && !Number.isNaN(days) && days > 0) {
        score += clamp(10 - (days / 18), -6, 10);
        if (days < 14) reasons.push('Fresh Listing');
    }

    const mileagePenalty = mileage > 0 ? clamp((mileage - 35000) / 18000, 0, 12) : 0;
    score -= mileagePenalty;
    if (mileage > 0 && mileage < 25000) reasons.push('Low Miles');

    const downPayment = price > 0 ? price * DOWN_PAYMENT_PERCENT : 0;

    switch (persona) {
        case 'commuter':
            if (fuel.includes('electric')) { score += 18; reasons.push('⚡️ EV'); }
            if (fuel.includes('hybrid')) { score += 10; reasons.push('🌱 Hybrid'); }
            if (body.includes('sedan')) score += 8;
            if (mileage > 0 && mileage <= 30000) score += 10;
            if (downPayment > 0 && downPayment <= 4500) { score += 8; reasons.push('💰 Low Down Pmt'); }
            break;
        case 'family':
            if (body.includes('suv')) { score += 16; reasons.push('🚙 SUV'); }
            if (body.includes('van')) { score += 14; reasons.push('🚐 Van'); }
            if (body.includes('truck')) score += 6;
            if (drivetrain.includes('awd') || drivetrain.includes('4wd')) { score += 8; reasons.push('AWD'); }
            if (mileage > 0 && mileage <= 50000) score += 6;
            break;
        case 'roadtrip':
            if (body.includes('suv')) score += 10;
            if (drivetrain.includes('awd') || drivetrain.includes('4wd')) { score += 10; reasons.push('⛰️ AWD'); }
            if (fuel.includes('diesel')) { score += 6; reasons.push('Diesel Range'); }
            if (transmission.includes('automatic')) score += 3;
            if (mileage > 0 && mileage <= 60000) { score += 6; reasons.push('Reliable Miles'); }
            break;
        case 'performance':
            if (body.includes('coupe')) { score += 16; reasons.push('🏎️ Coupe'); }
            if (body.includes('luxury')) score += 10;
            if (price >= 35000) score += 8;
            if (drivetrain.includes('awd') || drivetrain.includes('rwd')) { score += 6; reasons.push('RWD/AWD'); }
            break;
        case 'ev':
            if (fuel.includes('electric')) { score += 28; reasons.push('⚡️ Electric'); }
            if (fuel.includes('hybrid')) score -= 8;
            if (!fuel.includes('electric') && !fuel.includes('ev')) score -= 18;
            break;
        case 'budget':
            if (downPayment > 0) {
                score += clamp((7000 - downPayment) / 500, -10, 16);
                if (downPayment < 3000) reasons.push('📉 Low Down Pmt');
            }
            if (price > 0) {
                score += clamp((28000 - price) / 1200, -10, 18);
                if (price < 20000) reasons.push('💵 Budget Friendly');
            }
            if (dealScore >= 70) score += 6;
            break;
        default:
            break;
    }

    const finalScore = clamp(Math.round(score), 0, 99);
    // Prioritize persona-specific reasons, limit to top 2
    return { score: finalScore, reasons: reasons.slice(0, 2) };
}

function syncPersonaUI() {
    const pills = document.querySelectorAll('.persona-pill');
    if (!pills || pills.length === 0) return;
    pills.forEach(p => p.classList.remove('active'));

    if (personaLabel) {
        const map = {
            all: 'All',
            commuter: 'Commuter',
            family: 'Family',
            roadtrip: 'Road Trip',
            performance: 'Performance',
            ev: 'EV-first',
            budget: 'Budget'
        };
        personaLabel.textContent = map[currentPersona] || 'All';
    }

    if (rankingLabel) {
        rankingLabel.textContent = currentPersona === 'all' ? 'Ranked by deal score' : 'Ranked by persona match, then deal score';
    }

    for (const pill of pills) {
        const label = pill.querySelector('.persona-pill-label')?.innerText || '';
        const normalized = label.toLowerCase().replace(/\s+/g, '');
        if (normalized === 'all' && currentPersona === 'all') pill.classList.add('active');
        if (normalized === 'commuter' && currentPersona === 'commuter') pill.classList.add('active');
        if (normalized === 'family' && currentPersona === 'family') pill.classList.add('active');
        if (normalized === 'roadtrip' && currentPersona === 'roadtrip') pill.classList.add('active');
        if (normalized === 'performance' && currentPersona === 'performance') pill.classList.add('active');
        if ((normalized === 'ev-first' || normalized === 'evfirst') && currentPersona === 'ev') pill.classList.add('active');
        if (normalized === 'budget' && currentPersona === 'budget') pill.classList.add('active');
    }
}

function selectPersona(persona) {
    currentPersona = persona || 'all';
    localStorage.setItem('persona', currentPersona);
    syncPersonaUI();
    applyFilters();
}

function updateSavedCount() {
    // Smooth counter animation
    const animateCount = (el, newValue) => {
        if (!el) return;
        const oldValue = parseInt(el.textContent) || 0;
        const newVal = parseInt(newValue) || 0;
        if (oldValue === newVal) return;
        
        el.style.transform = 'scale(1.2)';
        el.textContent = String(newVal);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.style.transition = 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                el.style.transform = 'scale(1)';
            });
        });
    };
    
    animateCount(savedCountEl, favorites.size);
    animateCount(headerSavedCountEl, favorites.size);
}

function updateCompareCount() {
    if (!compareCountEl) return;
    const oldValue = parseInt(compareCountEl.textContent) || 0;
    const newValue = compare.size;
    if (oldValue === newValue) return;
    
    compareCountEl.style.transform = 'scale(1.2)';
    compareCountEl.textContent = String(newValue);
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            compareCountEl.style.transition = 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            compareCountEl.style.transform = 'scale(1)';
        });
    });
}

function persistCompare() {
    sessionStorage.setItem('compare', JSON.stringify([...compare]));
    updateCompareCount();
}

function clearAllFilters() {
    if (searchInput) searchInput.value = '';
    if (filterMake) filterMake.value = '';
    if (filterModel) filterModel.value = '';
    if (filterYear) filterYear.value = '';
    if (filterPrice) filterPrice.value = '';
    if (filterBody) filterBody.value = '';
    if (sortSelect) sortSelect.value = '';

    currentPersona = 'all';
    localStorage.setItem('persona', currentPersona);
    syncPersonaUI();
    populateModels();
    applyFilters();
}

function toggleCompare(id, btn) {
    const key = String(id);
    if (compare.has(key)) {
        compare.delete(key);
        if (btn) {
            // Enhanced smooth animation
            btn.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), background-color 0.2s';
            btn.style.transform = 'scale(0.9)';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    btn.classList.remove('active');
                    btn.textContent = 'Compare';
                    btn.style.transform = 'scale(1)';
                    setTimeout(() => {
                        btn.style.transition = '';
                    }, 300);
                });
            });
        }
        showToast('Removed from compare', 'info', 2000);
        updateCompareCount();
        persistCompare();
        refreshPulseFromData();
        return;
    }

    if (compare.size >= 3) {
        showToast('Maximum 3 cars can be compared', 'error', 3000);
        openCompare();
        return;
    }

    compare.add(key);
    if (btn) {
        // Enhanced smooth animation with spring effect
        btn.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), background-color 0.2s';
        btn.style.transform = 'scale(0.9)';
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                btn.style.transform = 'scale(1.1)';
                btn.classList.add('active');
                btn.textContent = 'Compared';
                setTimeout(() => {
                    btn.style.transform = 'scale(1)';
                    setTimeout(() => {
                        btn.style.transition = '';
                    }, 300);
                }, 150);
            });
        });
    }
    showToast('Added to compare', 'success', 2000);
    updateCompareCount();
    persistCompare();
    refreshPulseFromData();
}

function updateCompareCount() {
    const compareCountEl = document.getElementById('compare-count');
    if (compareCountEl) {
        const count = compare.size;
        animateValue(compareCountEl, parseInt(compareCountEl.textContent) || 0, count, 300);
    }
}

function updatePulseCount() {
    if (!pulseCountEl) return;
    const drops = Array.isArray(pulseState?.priceDrops) ? pulseState.priceDrops.length : 0;
    const increases = Array.isArray(pulseState?.priceIncreases) ? pulseState.priceIncreases.length : 0;
    const count = drops + increases;
    animateValue(pulseCountEl, parseInt(pulseCountEl.textContent) || 0, count, 250);
}

function openCompare() {
    if (!compareModal || !compareBody) return;

    lastFocusedElement = document.activeElement;

    const selected = [...compare]
        .map(id => allCars.find(c => String(c.id) === String(id)))
        .filter(Boolean);

    if (selected.length === 0) {
        compareBody.innerHTML = `
          <div class="ai-brief-card">
            <div class="ai-brief-label">No cars selected</div>
            <div class="ai-brief-note">Tap “Compare” on up to 3 listings to see them side-by-side.</div>
          </div>
        `;
    } else {
        const cols = selected.map(c => {
            const title = escapeHtml(`${c.year} ${c.make} ${c.model}`.trim());
            const img = escapeHtml(c.imageUrl || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800');
            const deal = escapeHtml(formatDealRating(c.dealRating) || 'No Price Analysis');
            const price = `$${Number(c.price || 0).toLocaleString()}`;
            const down = `$${Math.round(Number(c.price || 0) * DOWN_PAYMENT_PERCENT).toLocaleString()}`;
            const miles = c.mileage != null ? `${Math.round(Number(c.mileage || 0) / 1000)}k` : '--';
            const fuel = escapeHtml(c.fuelType || '--');
            const body = escapeHtml(c.bodyType || '--');
            const diff = c.priceDifferential != null && !Number.isNaN(Number(c.priceDifferential))
                ? (Number(c.priceDifferential) > 0
                    ? `$${Math.round(Number(c.priceDifferential)).toLocaleString()} below`
                    : `$${Math.abs(Math.round(Number(c.priceDifferential))).toLocaleString()} above`)
                : '--';
            const days = c.daysOnMarket != null && !Number.isNaN(Number(c.daysOnMarket)) && Number(c.daysOnMarket) > 0
                ? `${Math.round(Number(c.daysOnMarket))}d`
                : '--';

            return `
              <div class="compare-col">
                <div class="compare-hero">
                  <img src="${img}" alt="${title}" loading="lazy" referrerpolicy="no-referrer" crossorigin="anonymous">
                </div>
                <div class="compare-content">
                  <div class="compare-title">${title}</div>
                  <div class="compare-kv">
                    <div class="compare-kv-row"><span class="compare-k">Deal</span><span class="compare-v">${deal}</span></div>
                    <div class="compare-kv-row"><span class="compare-k">Price</span><span class="compare-v">${price}</span></div>
                    <div class="compare-kv-row"><span class="compare-k">Down</span><span class="compare-v">${down}</span></div>
                    <div class="compare-kv-row"><span class="compare-k">Miles</span><span class="compare-v">${miles}</span></div>
                    <div class="compare-kv-row"><span class="compare-k">Fuel</span><span class="compare-v">${fuel}</span></div>
                    <div class="compare-kv-row"><span class="compare-k">Body</span><span class="compare-v">${body}</span></div>
                    <div class="compare-kv-row"><span class="compare-k">Market</span><span class="compare-v">${diff}</span></div>
                    <div class="compare-kv-row"><span class="compare-k">DOM</span><span class="compare-v">${days}</span></div>
                  </div>
                  <div class="compare-actions">
                    <button type="button" class="compare-action" onclick="window.location.href='details.html?id=${c.id}'">View</button>
                    <button type="button" class="compare-action" onclick="removeCompare('${escapeHtml(String(c.id))}')">Remove</button>
                  </div>
                </div>
              </div>
            `;
        }).join('');

        compareBody.innerHTML = `
          <div class="compare-table">
            <div class="ai-brief-card">
              <div class="ai-brief-label">Tip</div>
              <div class="ai-brief-note">Compare focuses on deal + affordability + signals. Add up to 3 cars.</div>
            </div>
            <div class="compare-grid">${cols}</div>
          </div>
        `;
    }

    compareModal.classList.add('open');
    compareModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const closeBtn = compareModal.querySelector('[data-ai-modal-close="true"]');
    if (closeBtn && closeBtn.focus) closeBtn.focus();
}

function closeCompare() {
    if (!compareModal) return;
    compareModal.classList.remove('open');
    compareModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
}

function removeCompare(id) {
    compare.delete(String(id));
    persistCompare();
    openCompare();
    applyFilters();
}

function openSaved() {
    if (!savedModal || !savedBody) return;

    lastFocusedElement = document.activeElement;

    const savedCars = allCars.filter(c => favorites.has(c.id));
    if (savedCars.length === 0) {
        savedBody.innerHTML = `
          <div class="ai-brief-card">
            <div class="ai-brief-label">No saved cars yet</div>
            <div class="ai-brief-note">Tap the heart on any listing to save it here.</div>
          </div>
        `;
    } else {
        const rows = savedCars.slice(0, 50).map(c => {
            const title = escapeHtml(`${c.year} ${c.make} ${c.model}`.trim());
            const meta = escapeHtml(`${Math.round((c.mileage || 0) / 1000)}k miles • $${(c.price || 0).toLocaleString()}`);
            const img = escapeHtml(c.imageUrl || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800');
            return `
              <div class="saved-row">
                <div class="saved-thumb"><img src="${img}" alt="${title}" loading="lazy" referrerpolicy="no-referrer" crossorigin="anonymous"></div>
                <div>
                  <div class="saved-title">${title}</div>
                  <div class="saved-meta">${meta}</div>
                </div>
                <div class="saved-actions">
                  <button type="button" class="saved-action" onclick="window.location.href='details.html?id=${c.id}'">View</button>
                  <button type="button" class="saved-action" onclick="removeSaved(${c.id})">Remove</button>
                </div>
              </div>
            `;
        }).join('');

        savedBody.innerHTML = rows;
    }

    savedModal.classList.add('open');
    savedModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const closeBtn = savedModal.querySelector('[data-ai-modal-close="true"]');
    if (closeBtn && closeBtn.focus) closeBtn.focus();
}

function closeSaved() {
    if (!savedModal) return;
    savedModal.classList.remove('open');
    savedModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
}

function openPulse() {
    if (!pulseModal || !pulseBody) return;

    refreshPulseFromData();

    lastFocusedElement = document.activeElement;

    const trackedCount = favorites.size + compare.size + (Array.isArray(sharedShortlistIds) ? sharedShortlistIds.length : 0);
    const dropCount = Array.isArray(pulseState?.priceDrops) ? pulseState.priceDrops.length : 0;
    const increaseCount = Array.isArray(pulseState?.priceIncreases) ? pulseState.priceIncreases.length : 0;

    const renderEventRow = (evt, label) => {
        const car = allCars.find(c => String(c.id) === String(evt.id));
        if (!car) return '';
        const title = escapeHtml(`${car.year || ''} ${car.make || ''} ${car.model || ''}`.trim());
        const img = escapeHtml(car.imageUrl || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800');
        const miles = Math.round(Number(car.mileage || 0) / 1000);
        const meta = escapeHtml(`${Number.isFinite(miles) ? `${miles}k miles` : '--'} • ${money(Number(car.price || 0))}`);
        const delta = money(Math.round(Number(evt.delta || 0)));
        return `
          <div class="saved-row">
            <div class="saved-thumb"><img src="${img}" alt="${title}" loading="lazy" referrerpolicy="no-referrer" crossorigin="anonymous"></div>
            <div>
              <div class="saved-title">${title}</div>
              <div class="saved-meta">${meta}</div>
              <div class="match-reasons">
                <span class="match-reason-pill">${escapeHtml(label)} ${escapeHtml(delta)}</span>
              </div>
            </div>
            <div class="saved-actions">
              <button type="button" class="saved-action" data-ai-action="brief" data-ai-car-id="${escapeHtml(String(car.id))}">Brief</button>
              <button type="button" class="saved-action" data-ai-action="view" data-ai-car-id="${escapeHtml(String(car.id))}">View</button>
            </div>
          </div>
        `;
    };

    const dropsHtml = dropCount
        ? pulseState.priceDrops.map(evt => renderEventRow(evt, 'Price dropped')).join('')
        : `
          <div class="ai-brief-card">
            <div class="ai-brief-label">No price drops yet</div>
            <div class="ai-brief-note">Pulse will light up when saved/compared cars change price.</div>
          </div>
        `;

    const increasesHtml = increaseCount
        ? pulseState.priceIncreases.map(evt => renderEventRow(evt, 'Price increased')).join('')
        : '';

    pulseBody.innerHTML = `
      <div class="ai-brief-card">
        <div class="ai-brief-label">Pulse Summary</div>
        <div class="ai-brief-value">${favorites.size.toLocaleString()} saved • ${compare.size.toLocaleString()} compared</div>
        <div class="ai-brief-note">${dropCount.toLocaleString()} drops • ${increaseCount.toLocaleString()} increases • tracking ${trackedCount.toLocaleString()} cars</div>
      </div>
      <div class="ai-brief-card">
        <div class="ai-brief-label">Price Drop Pulse</div>
        <div class="ai-brief-note">Signals from the cars you’re actively watching.</div>
        <div class="ai-similar-stack">${dropsHtml}</div>
      </div>
      ${increaseCount ? `
        <div class="ai-brief-card">
          <div class="ai-brief-label">Price Increases</div>
          <div class="ai-brief-note">Heads up: some listings are moving up.</div>
          <div class="ai-similar-stack">${increasesHtml}</div>
        </div>
      ` : ''}
    `;

    pulseModal.classList.add('open');
    pulseModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const closeBtn = pulseModal.querySelector('[data-ai-modal-close="true"]');
    if (closeBtn && closeBtn.focus) closeBtn.focus();
}

function closePulse() {
    if (!pulseModal) return;
    pulseModal.classList.remove('open');
    pulseModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
}

function removeSaved(id) {
    favorites.delete(id);
    localStorage.setItem('favorites', JSON.stringify([...favorites]));
    updateSavedCount();
    refreshPulseFromData();
    openSaved();
}

function escapeHtml(input) {
    return String(input)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function toggleFavoriteById(id) {
    const key = typeof id === 'number' ? id : String(id);
    const numeric = Number(key);
    const storedKey = Number.isNaN(numeric) ? key : numeric;

    if (favorites.has(storedKey)) {
        favorites.delete(storedKey);
        localStorage.setItem('favorites', JSON.stringify([...favorites]));
        updateSavedCount();
        refreshPulseFromData();
        return false;
    }
    favorites.add(storedKey);
    localStorage.setItem('favorites', JSON.stringify([...favorites]));
    updateSavedCount();
    refreshPulseFromData();
    return true;
}

function handleCardImageLoad(img) {
    const wrapper = img.closest('.car-image-wrapper');
    if (wrapper) wrapper.classList.add('loaded');
}

function handleCardImageError(img) {
    img.src = 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800';
    const wrapper = img.closest('.car-image-wrapper');
    if (wrapper) wrapper.classList.add('loaded');
}

function computeBriefConfidence(rawCar) {
    const signals = [
        rawCar.price != null && rawCar.price > 0,
        rawCar.mileage != null && rawCar.mileage >= 0,
        rawCar.dealRating && rawCar.dealRating !== 'No Price Analysis',
        rawCar.priceDifferential != null && !Number.isNaN(Number(rawCar.priceDifferential)),
        rawCar.daysOnMarket != null && !Number.isNaN(Number(rawCar.daysOnMarket)),
        rawCar.dealer?.name,
        rawCar.imageUrl
    ];
    const score = signals.filter(Boolean).length / signals.length;
    if (score >= 0.78) return 'High';
    if (score >= 0.52) return 'Medium';
    return 'Low';
}

function money(amount) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function computeMonthlyPayment(price, downPaymentAmount) {
    if (!price || price <= 0) return null;
    const monthly = Math.round(((price - downPaymentAmount) * 1.07) / 60);
    return monthly > 0 ? monthly : null;
}

function computeValueScore(car) {
    const dealScore = car.dealScore != null ? Number(car.dealScore) : 0;
    const diff = car.priceDifferential != null ? Number(car.priceDifferential) : null;
    const days = car.daysOnMarket != null ? Number(car.daysOnMarket) : null;
    const mileage = car.mileage != null ? Number(car.mileage) : null;

    let score = 58;
    score += clamp(dealScore * 0.4, 0, 26);
    if (diff != null && !Number.isNaN(diff)) score += clamp(diff / 700, -12, 16);
    if (days != null && !Number.isNaN(days) && days > 0) score += clamp(12 - (days / 16), -8, 12);
    if (mileage != null && !Number.isNaN(mileage) && mileage > 0) score -= clamp((mileage - 35000) / 16000, 0, 16);
    return clamp(Math.round(score), 0, 99);
}

function buildFlags(car) {
    const flags = [];
    const price = Number(car.price || 0);
    const mileage = Number(car.mileage || 0);
    const diff = car.priceDifferential != null ? Number(car.priceDifferential) : null;
    const days = car.daysOnMarket != null ? Number(car.daysOnMarket) : null;
    const dealRatingText = formatDealRating(car.dealRating);

    if (!car.vin) flags.push('Missing VIN (ask dealer to confirm)');
    if (!car.dealer?.name) flags.push('Dealer name missing');
    if (!car.imageUrl) flags.push('No photo URL found');
    if (!dealRatingText || dealRatingText === 'No Price Analysis') flags.push('No price analysis available');

    if (mileage > 85000) flags.push('High mileage for most buyers');
    if (days != null && !Number.isNaN(days) && days >= 65) flags.push('Long time on market (check history)');
    if (diff != null && !Number.isNaN(diff) && diff < -2000) flags.push('Priced above market average');
    if (price > 0 && price < 6000) flags.push('Very low price (verify title + condition)');

    return flags;
}

function buildProsCons(car) {
    const pros = [];
    const cons = [];

    const price = Number(car.price || 0);
    const mileage = Number(car.mileage || 0);
    const diff = car.priceDifferential != null ? Number(car.priceDifferential) : null;
    const days = car.daysOnMarket != null ? Number(car.daysOnMarket) : null;
    const fuel = normalizeText(car.fuelType);
    const dealRatingText = formatDealRating(car.dealRating);

    if (dealRatingText && dealRatingText !== 'No Price Analysis' && (dealRatingText.includes('Great') || dealRatingText.includes('Good'))) {
        pros.push(`${dealRatingText} rating`);
    }
    if (diff != null && !Number.isNaN(diff) && diff > 0) pros.push(`${money(Math.round(diff))} below market`);
    if (mileage > 0 && mileage <= 30000) pros.push('Low mileage');
    if (fuel.includes('electric')) pros.push('Electric (lower fuel cost)');
    if (fuel.includes('hybrid')) pros.push('Hybrid (better efficiency)');

    if (diff != null && !Number.isNaN(diff) && diff < 0) cons.push(`${money(Math.abs(Math.round(diff)))} above market`);
    if (mileage > 65000) cons.push('Higher mileage');
    if (days != null && !Number.isNaN(days) && days >= 55) cons.push('Long time on market');
    if (!car.vin) cons.push('VIN missing');
    if (!car.dealer?.name) cons.push('Dealer info incomplete');
    if (!car.imageUrl) cons.push('Photos missing');
    if (price <= 0) cons.push('Price missing');

    return { pros: pros.slice(0, 4), cons: cons.slice(0, 4) };
}

function getSimilarPicks(baseCar, limit = 3) {
    const baseYear = Number(baseCar.year || baseCar.carYear || 0);
    const basePrice = Number(baseCar.price || 0);
    const baseMiles = Number(baseCar.mileage || 0);
    const baseMake = String(baseCar.make || baseCar.makeName || '').toLowerCase().trim();
    const baseModel = String(baseCar.model || baseCar.modelName || '').toLowerCase().trim();
    const baseBody = String(baseCar.bodyType || '').toLowerCase().trim();
    const baseDealScore = baseCar.dealScore != null ? Number(baseCar.dealScore) : null;

    const scored = allCars
        .filter(c => String(c.id) !== String(baseCar.id))
        .map((c) => {
            const year = Number(c.year || c.carYear || 0);
            const price = Number(c.price || 0);
            const miles = Number(c.mileage || 0);
            const make = String(c.make || c.makeName || '').toLowerCase().trim();
            const model = String(c.model || c.modelName || '').toLowerCase().trim();
            const body = String(c.bodyType || '').toLowerCase().trim();
            const dealScore = c.dealScore != null ? Number(c.dealScore) : null;

            let score = 0;
            if (baseMake && make && baseMake === make) score += 4;
            if (baseModel && model && baseModel === model) score += 3;
            if (baseBody && body && baseBody === body) score += 1.5;

            if (baseYear && year) score += Math.max(0, 3 - Math.abs(baseYear - year));
            if (basePrice && price) score += Math.max(0, 3 - (Math.abs(basePrice - price) / 5000));
            if (baseMiles && miles) score += Math.max(0, 3 - (Math.abs(baseMiles - miles) / 20000));

            if (baseDealScore != null && !Number.isNaN(baseDealScore) && dealScore != null && !Number.isNaN(dealScore)) {
                const diff = dealScore - baseDealScore;
                if (diff > 0) score += Math.min(1.5, diff / 20);
            }

            const reasons = [];
            if (baseMake && make && baseMake === make && baseModel && model && baseModel === model) {
                reasons.push('Same make & model');
            } else if (baseMake && make && baseMake === make) {
                reasons.push('Same make');
            }
            if (baseBody && body && baseBody === body) reasons.push('Same body type');

            if (basePrice && price) {
                const priceDeltaAbs = Math.abs(basePrice - price);
                if (priceDeltaAbs <= 2000) reasons.push('Within $2k');
                else if (priceDeltaAbs <= 5000) reasons.push('Within $5k');
                if (price < basePrice - 1500) reasons.push('Cheaper');
            }

            if (baseYear && year && year > baseYear) reasons.push('Newer year');
            if (baseMiles && miles && miles < baseMiles - 8000) reasons.push('Lower miles');

            if (baseDealScore != null && !Number.isNaN(baseDealScore) && dealScore != null && !Number.isNaN(dealScore) && dealScore > baseDealScore + 10) {
                reasons.push('Higher deal score');
            }

            return { car: c, score, reasons: reasons.slice(0, 3) };
        })
        .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
}

function renderDealBrief(carId) {
    if (!aiBriefBody || !aiBriefTitle) return;

    const car = allCars.find(c => String(c.id) === String(carId));
    if (!car) return;

    currentBriefCarId = String(car.id);

    const year = car.year || car.carYear || '';
    const make = car.make || car.makeName || '';
    const model = car.model || car.modelName || '';
    const trim = car.trim || car.trimName || '';

    const title = `${year} ${make} ${model}${trim ? ` ${trim}` : ''}`.trim();
    aiBriefTitle.textContent = title || 'Deal Brief';

    const price = Number(car.price || 0);
    const mileage = Number(car.mileage || 0);
    const downPayment = Math.round(price * DOWN_PAYMENT_PERCENT);
    const monthly = computeMonthlyPayment(price, downPayment);

    const dealRatingText = formatDealRating(car.dealRating);
    const dealScore = car.dealScore != null ? Number(car.dealScore) : null;
    const valueScore = computeValueScore(car);
    const diff = car.priceDifferential != null ? Number(car.priceDifferential) : null;
    const days = car.daysOnMarket != null ? Number(car.daysOnMarket) : null;

    const confidence = computeBriefConfidence(car);
    const personaMatch = currentPersona !== 'all' ? getPersonaMatch(car) : null;

    const marketLine = (diff == null || Number.isNaN(diff))
        ? 'Market delta unavailable'
        : diff > 0
            ? `${money(Math.round(diff))} below market average`
            : `${money(Math.abs(Math.round(diff)))} above market average`;

    const daysLine = (days == null || Number.isNaN(days) || days <= 0)
        ? 'Days on market unavailable'
        : `${Math.round(days)} days on market`;

    const mileageLine = mileage > 0 ? `${Math.round(mileage / 1000)}k miles` : 'Mileage unavailable';

    const dealerName = car.dealer?.name ? escapeHtml(car.dealer.name) : 'Dealer info unavailable';
    const dealerRating = car.dealer?.rating != null ? Number(car.dealer.rating) : null;
    const dealerReviews = car.dealer?.reviews != null ? Number(car.dealer.reviews) : null;
    const dealerLine = (dealerRating && dealerReviews != null)
        ? `${dealerName} • ${dealerRating.toFixed(1)}★ (${dealerReviews.toLocaleString()} reviews)`
        : dealerName;

    const flags = buildFlags(car);
    const { pros, cons } = buildProsCons(car);

    const isSaved = favorites.has(Number.isNaN(Number(currentBriefCarId)) ? currentBriefCarId : Number(currentBriefCarId));
    const isCompared = compare.has(String(car.id));

    const questions = [
        'Can you confirm the out-the-door price (tax, title, fees)?',
        'Do you have the full service history and any accident reports?',
        'What is the return policy / inspection window?',
        'Are there any open recalls or reconditioning notes?',
    ];

    if (diff != null && !Number.isNaN(diff) && diff > 0) {
        questions.unshift('Why is this priced below market? Any known issues or constraints?');
    }

    const summaryBadges = `
      <div class="ai-badges">
        <span class="ai-badge">${escapeHtml(dealRatingText || 'No Price Analysis')}</span>
        <span class="ai-badge blue">Value ${valueScore}</span>
        ${personaMatch ? `<span class="ai-badge blue">${escapeHtml(currentPersona.toUpperCase())} Match ${personaMatch.score}</span>` : ''}
        <span class="ai-badge muted">Confidence ${escapeHtml(confidence)}</span>
      </div>
    `;

    const metersHtml = `
      <div class="ai-brief-card">
        <div class="ai-brief-label">AI Scores</div>
        <div class="ai-meters">
          <div class="ai-meter">
            <div class="ai-meter-top"><span>Value</span><span>${valueScore}</span></div>
            <div class="ai-meter-bar"><div class="ai-meter-fill" style="width:${valueScore}%;"></div></div>
          </div>
          <div class="ai-meter">
            <div class="ai-meter-top"><span>Deal Score</span><span>${dealScore != null && !Number.isNaN(dealScore) ? Math.round(dealScore) : '--'}</span></div>
            <div class="ai-meter-bar"><div class="ai-meter-fill" style="width:${dealScore != null && !Number.isNaN(dealScore) ? clamp(Math.round(dealScore), 0, 99) : 0}%;"></div></div>
          </div>
          ${personaMatch ? `
          <div class="ai-meter">
            <div class="ai-meter-top"><span>Persona Match</span><span>${personaMatch.score}</span></div>
            <div class="ai-meter-bar"><div class="ai-meter-fill" style="width:${personaMatch.score}%;"></div></div>
          </div>` : ''}
        </div>
      </div>
    `;

    const metricsHtml = `
      <div class="ai-brief-grid">
        <div class="ai-brief-card">
          <div class="ai-brief-label">Market Context</div>
          <div class="ai-brief-value">${escapeHtml(marketLine)}</div>
          <div class="ai-brief-note">${escapeHtml(daysLine)}</div>
        </div>
        <div class="ai-brief-card">
          <div class="ai-brief-label">Affordability</div>
          <div class="ai-brief-value">${money(downPayment)} down${monthly ? ` • $${monthly}/mo` : ''}</div>
          <div class="ai-brief-note">Cash price ${money(price || 0)} • ${(DOWN_PAYMENT_PERCENT * 100).toFixed(0)}% down assumption</div>
        </div>
        <div class="ai-brief-card">
          <div class="ai-brief-label">Listing Signals</div>
          <div class="ai-brief-value">${escapeHtml(mileageLine)}</div>
          <div class="ai-brief-note">${escapeHtml(dealerLine)}</div>
        </div>
        <div class="ai-brief-card">
          <div class="ai-brief-label">Tradeoffs</div>
          <div class="ai-brief-note">${pros.length ? `<span class="ai-inline-label">Pros:</span> ${escapeHtml(pros.join(' • '))}` : 'Pros unavailable'}</div>
          <div class="ai-brief-note">${cons.length ? `<span class="ai-inline-label">Cons:</span> ${escapeHtml(cons.join(' • '))}` : 'Cons unavailable'}</div>
        </div>
      </div>
    `;

    const similar = getSimilarPicks(car, 5);
    const compPrices = similar.map(s => Number(s?.car?.price || 0)).filter(p => p > 0);
    const compMin = compPrices.length ? Math.min(...compPrices) : null;
    const compMax = compPrices.length ? Math.max(...compPrices) : null;
    const compAvg = compPrices.length ? Math.round(compPrices.reduce((a, b) => a + b, 0) / compPrices.length) : null;

    const marketAvg = (diff != null && !Number.isNaN(diff)) ? (price + diff) : null;
    const anchor = (compAvg != null && compAvg > 0) ? compAvg : ((marketAvg != null && marketAvg > 0) ? marketAvg : null);

    let startOffer = price;
    if (anchor != null && anchor > 0) {
        if (price > anchor) startOffer = anchor;
        else startOffer = price - clamp((anchor - price) * 0.12, 250, 900);
    }
    if (days != null && !Number.isNaN(days) && days >= 70) startOffer -= 350;
    if (days != null && !Number.isNaN(days) && days >= 90) startOffer -= 450;
    startOffer = clamp(Math.round(startOffer / 50) * 50, 0, price);

    const aimOffer = clamp(Math.round((startOffer + 700) / 50) * 50, 0, price);
    const maxPayBase = anchor != null && anchor > 0 ? Math.min(price, anchor + 600) : price;
    const maxPay = clamp(Math.round(maxPayBase / 50) * 50, 0, price);

    const leverage = [];
    if (diff != null && !Number.isNaN(diff) && diff > 0) leverage.push(`${money(Math.round(diff))} below market`);
    if (diff != null && !Number.isNaN(diff) && diff < 0) leverage.push(`${money(Math.abs(Math.round(diff)))} above market`);
    if (days != null && !Number.isNaN(days) && days >= 60) leverage.push(`${Math.round(days)} days on market`);
    if (dealRatingText && dealRatingText.includes('Great')) leverage.push('Great deal rating');
    if (dealRatingText && dealRatingText.includes('Good')) leverage.push('Good deal rating');
    if (compAvg != null && compMin != null && compMax != null) leverage.push(`Comps ${money(compMin)}–${money(compMax)}`);

    const compsHtml = compAvg != null && compMin != null && compMax != null ? `
      <div class="ai-brief-card">
        <div class="ai-brief-label">Comps</div>
        <div class="ai-brief-value">${money(compAvg)} avg</div>
        <div class="ai-brief-note">${money(compMin)}–${money(compMax)} from similar picks in this inventory.</div>
      </div>
    ` : '';

    const negotiationTextRaw = `Hi ${car.dealer?.name ? car.dealer.name : 'there'} — I'm interested in this ${title}. If you can do ${money(aimOffer)} out-the-door, I can come in today. Can you send the full OTD breakdown (tax/title/fees) and confirm it's still available?`;
    const negotiationScript = escapeHtml(negotiationTextRaw);

    const negotiationHtml = `
      <div class="ai-brief-card">
        <div class="ai-brief-label">Negotiation Plan</div>
        <div class="ai-brief-value">Start ${money(startOffer)} • Aim ${money(aimOffer)} • Max ${money(maxPay)}</div>
        <div class="ai-brief-note">${leverage.length ? `Based on: ${escapeHtml(leverage.slice(0, 4).join(' • '))}` : 'Based on market + inventory signals.'}</div>
        <div class="ai-brief-note"><span class="ai-inline-label">Text:</span> ${negotiationScript}</div>
      </div>
    `;

    const flagsHtml = `
      <div class="ai-brief-card">
        <div class="ai-brief-label">Risk Flags</div>
        ${flags.length
            ? `<div class="ai-flags">${flags.map(f => `<span class="ai-flag">${escapeHtml(f)}</span>`).join('')}</div>`
            : `<div class="ai-brief-note">No obvious red flags from available data.</div>`}
      </div>
    `;

    briefCopyState = {
        carId: String(car.id),
        negotiationText: negotiationTextRaw,
        questionsText: questions.map(q => `- ${q}`).join('\n')
    };

    const shareHtml = `
      <div class="ai-brief-card ai-actions">
        <button type="button" class="ai-action-btn" data-ai-action="copy-brief-link" data-ai-car-id="${escapeHtml(String(car.id))}">
          Copy Brief Link
        </button>
        <button type="button" class="ai-action-btn" data-ai-action="copy-negotiation" data-ai-car-id="${escapeHtml(String(car.id))}">
          Copy Offer Text
        </button>
        <button type="button" class="ai-action-btn" data-ai-action="copy-questions" data-ai-car-id="${escapeHtml(String(car.id))}">
          Copy Questions
        </button>
      </div>
    `;

    const actionsHtml = `
      <div class="ai-brief-card ai-actions">
        <button type="button" class="ai-action-btn ${isSaved ? 'active' : ''}" data-ai-action="save" data-ai-car-id="${escapeHtml(String(car.id))}">
          ${isSaved ? 'Saved' : 'Save'}
        </button>
        <button type="button" class="ai-action-btn ${isCompared ? 'active' : ''}" data-ai-action="compare" data-ai-car-id="${escapeHtml(String(car.id))}">
          ${isCompared ? 'Compared' : 'Compare'}
        </button>
        <button type="button" class="ai-action-btn primary" data-ai-action="view" data-ai-car-id="${escapeHtml(String(car.id))}">
          View Details
        </button>
      </div>
    `;

    const questionsHtml = `
      <div class="ai-brief-card">
        <div class="ai-brief-label">Questions To Ask</div>
        <ul class="ai-brief-list">
          ${questions.map(q => `<li>${escapeHtml(q)}</li>`).join('')}
        </ul>
      </div>
    `;

    const similarHtml = similar.length ? `
      <div class="ai-brief-card">
        <div class="ai-brief-label">AI Similar Picks</div>
        <div class="ai-brief-note">Comparable listings from this inventory, with reasons.</div>
        <div class="ai-similar-stack">
          ${similar.slice(0, 3).map((s) => {
            const c = s.car;
            const title = escapeHtml(`${c.year || ''} ${c.make || ''} ${c.model || ''}`.trim());
            const meta = escapeHtml(`${Math.round(Number(c.mileage || 0) / 1000)}k miles • $${Number(c.price || 0).toLocaleString()}`);
            const img = escapeHtml(c.imageUrl || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800');
            const reasonsHtml = s.reasons?.length
                ? `<div class="match-reasons">${s.reasons.map(r => `<span class="match-reason-pill">${escapeHtml(r)}</span>`).join('')}</div>`
                : '';
            return `
              <div class="saved-row">
                <div class="saved-thumb"><img src="${img}" alt="${title}" loading="lazy" referrerpolicy="no-referrer" crossorigin="anonymous"></div>
                <div>
                  <div class="saved-title">${title}</div>
                  <div class="saved-meta">${meta}</div>
                  ${reasonsHtml}
                </div>
                <div class="saved-actions">
                  <button type="button" class="saved-action" data-ai-action="brief" data-ai-car-id="${escapeHtml(String(c.id))}">Brief</button>
                  <button type="button" class="saved-action" data-ai-action="view" data-ai-car-id="${escapeHtml(String(c.id))}">View</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : '';

    aiBriefBody.innerHTML = summaryBadges + metersHtml + metricsHtml + negotiationHtml + compsHtml + flagsHtml + shareHtml + actionsHtml + questionsHtml + similarHtml;
}

function openDealBrief(carId) {
    if (!aiBriefModal || !aiBriefBody || !aiBriefTitle) return;

    const car = allCars.find(c => String(c.id) === String(carId));
    if (!car) return;

    lastFocusedElement = document.activeElement;
    renderDealBrief(car.id);

    aiBriefModal.classList.add('open');
    aiBriefModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const closeBtn = aiBriefModal.querySelector('[data-ai-modal-close="true"]');
    if (closeBtn && closeBtn.focus) closeBtn.focus();
}

function closeDealBrief() {
    if (!aiBriefModal) return;
    aiBriefModal.classList.remove('open');
    aiBriefModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentBriefCarId = null;
    if (lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
}
