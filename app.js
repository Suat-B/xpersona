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
let lastFocusedElement = null;
let currentBriefCarId = null;

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    setupEventListeners();
    setupHeaderScroll();
    setupInfiniteScroll();
    await loadCars();
    syncPersonaUI();
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
            if (action === 'view') {
                window.location.href = `details.html?id=${carId}`;
                return;
            }
        });
    }

    const queryChips = document.querySelectorAll('.ai-query-chip');
    queryChips.forEach((chip) => {
        chip.addEventListener('click', () => {
            const q = chip.getAttribute('data-ai-query') || chip.textContent || '';
            if (searchInput) searchInput.value = q.trim();
            applyFilters();
        });
    });

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

    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (!filtersPanel) return;
        if (filtersPanel.getAttribute('aria-hidden') === 'false') setFiltersOpen(false);
    });

    if (savedBtn) savedBtn.addEventListener('click', openSaved);
    if (headerSavedBtn) headerSavedBtn.addEventListener('click', openSaved);
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
        keywords: []
    };

    if (!query) return result;

    const lowerQuery = query.toLowerCase().trim();

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

    // Match price patterns: "under 20000", "below $30k", "less than 25000"
    const underPriceMatch = lowerQuery.match(/(under|below|less\s*than|max)\s*\$?(\d+[,.]?\d*k?)/i);
    if (underPriceMatch) {
        let amount = underPriceMatch[2].replace(/[$,]/g, '');
        if (amount.endsWith('k')) {
            amount = parseFloat(amount) * 1000;
        } else {
            amount = parseFloat(amount);
        }
        result.maxPrice = amount;
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

    // Extract remaining keywords (remove matched price/down patterns)
    let cleanQuery = lowerQuery
        .replace(/(\$?\d+[,.]?\d*k?)\s*down/gi, '')
        .replace(/(under|below|less\s*than|max|over|above|more\s*than|min)\s*\$?(\d+[,.]?\d*k?)/gi, '')
        .trim();

    if (cleanQuery) {
        result.keywords = cleanQuery.split(/\s+/).filter(w => w.length > 1);
    }

    return result;
}

function applyFilters() {
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

        // Natural language down payment filter (10% down payment = price * 0.1)
        if (nlSearch.maxDownPayment) {
            const downPayment = car.price * 0.1;
            if (downPayment > nlSearch.maxDownPayment) return false;
        }

        // Natural language price filters
        if (nlSearch.maxPrice && car.price > nlSearch.maxPrice) return false;
        if (nlSearch.minPrice && car.price < nlSearch.minPrice) return false;

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

    // Reset and render first batch
    displayedCount = 0;
    carGrid.innerHTML = '';
    loadMoreCars();
}

function loadMoreCars() {
    if (isLoading || displayedCount >= filteredCars.length) return;

    isLoading = true;
    if (scrollLoader) scrollLoader.style.display = 'flex';

    // Use requestAnimationFrame for smooth rendering
    requestAnimationFrame(() => {
        const batch = filteredCars.slice(displayedCount, displayedCount + batchSize);
        const fragment = document.createDocumentFragment();

        batch.forEach(car => {
            const article = document.createElement('article');
            article.className = 'car-card';
            article.innerHTML = createCarCardHTML(car);
            article.addEventListener('click', () => {
                window.location.href = `details.html?id=${car.id}`;
            });
            fragment.appendChild(article);
        });

        carGrid.appendChild(fragment);
        displayedCount += batch.length;

        // Update counts
        if (showingCount) showingCount.textContent = displayedCount.toLocaleString();
        if (totalCount) totalCount.textContent = filteredCars.length.toLocaleString();

        // Handle empty state
        if (emptyState) {
            if (filteredCars.length === 0) {
                emptyState.style.display = 'block';
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
    if (updated) {
        btn.classList.add('active');
        btn.querySelector('svg').setAttribute('fill', '#ff4444');
        btn.querySelector('svg').setAttribute('stroke', '#ff4444');
    } else {
        btn.classList.remove('active');
        btn.querySelector('svg').setAttribute('fill', 'none');
        btn.querySelector('svg').setAttribute('stroke', '#666');
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
    if (persona === 'all') return { score: 0 };

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
    score += clamp((dealScore || 0) * 0.35, 0, 22);

    if (diff != null && !Number.isNaN(diff)) {
        score += clamp(diff / 600, -14, 16);
    }

    if (days != null && !Number.isNaN(days) && days > 0) {
        score += clamp(10 - (days / 18), -6, 10);
    }

    const mileagePenalty = mileage > 0 ? clamp((mileage - 35000) / 18000, 0, 12) : 0;
    score -= mileagePenalty;

    const downPayment = price > 0 ? price * DOWN_PAYMENT_PERCENT : 0;

    switch (persona) {
        case 'commuter':
            if (fuel.includes('electric')) score += 18;
            if (fuel.includes('hybrid')) score += 10;
            if (body.includes('sedan')) score += 8;
            if (mileage > 0 && mileage <= 30000) score += 10;
            if (downPayment > 0 && downPayment <= 4500) score += 8;
            break;
        case 'family':
            if (body.includes('suv')) score += 16;
            if (body.includes('van')) score += 14;
            if (body.includes('truck')) score += 6;
            if (drivetrain.includes('awd') || drivetrain.includes('4wd')) score += 8;
            if (mileage > 0 && mileage <= 50000) score += 6;
            break;
        case 'roadtrip':
            if (body.includes('suv')) score += 10;
            if (drivetrain.includes('awd') || drivetrain.includes('4wd')) score += 10;
            if (fuel.includes('diesel')) score += 6;
            if (transmission.includes('automatic')) score += 3;
            if (mileage > 0 && mileage <= 60000) score += 6;
            break;
        case 'performance':
            if (body.includes('coupe')) score += 16;
            if (body.includes('luxury')) score += 10;
            if (price >= 35000) score += 8;
            if (drivetrain.includes('awd') || drivetrain.includes('rwd')) score += 6;
            break;
        case 'ev':
            if (fuel.includes('electric')) score += 28;
            if (fuel.includes('hybrid')) score -= 8;
            if (!fuel.includes('electric') && !fuel.includes('ev')) score -= 18;
            break;
        case 'budget':
            if (downPayment > 0) {
                score += clamp((7000 - downPayment) / 500, -10, 16);
            }
            if (price > 0) {
                score += clamp((28000 - price) / 1200, -10, 18);
            }
            if (dealScore >= 70) score += 6;
            break;
        default:
            break;
    }

    const finalScore = clamp(Math.round(score), 0, 99);
    return { score: finalScore };
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
    if (savedCountEl) savedCountEl.textContent = String(favorites.size);
    if (headerSavedCountEl) headerSavedCountEl.textContent = String(favorites.size);
}

function updateCompareCount() {
    if (compareCountEl) compareCountEl.textContent = String(compare.size);
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
            btn.classList.remove('active');
            btn.textContent = 'Compare';
        }
        persistCompare();
        return;
    }

    if (compare.size >= 3) {
        openCompare();
        return;
    }

    compare.add(key);
    if (btn) {
        btn.classList.add('active');
        btn.textContent = 'Compared';
    }
    persistCompare();
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

function removeSaved(id) {
    favorites.delete(id);
    localStorage.setItem('favorites', JSON.stringify([...favorites]));
    updateSavedCount();
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
        return false;
    }
    favorites.add(storedKey);
    localStorage.setItem('favorites', JSON.stringify([...favorites]));
    updateSavedCount();
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

    const flagsHtml = `
      <div class="ai-brief-card">
        <div class="ai-brief-label">Risk Flags</div>
        ${flags.length
            ? `<div class="ai-flags">${flags.map(f => `<span class="ai-flag">${escapeHtml(f)}</span>`).join('')}</div>`
            : `<div class="ai-brief-note">No obvious red flags from available data.</div>`}
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

    aiBriefBody.innerHTML = summaryBadges + metersHtml + metricsHtml + flagsHtml + actionsHtml + questionsHtml;
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



