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
const DOWN_PAYMENT_PERCENT = 0.1;

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

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    setupEventListeners();
    setupHeaderScroll();
    setupInfiniteScroll();
    await loadCars();
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
}

function setupHeaderScroll() {
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
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
        const response = await fetch('cars.json');
        if (!response.ok) throw new Error('Failed to load cars');
        const rawData = await response.json();

        allCars = rawData.map((car, i) => normalizeCar(car, i));
        filteredCars = [...allCars];

        populateFilters();
        updateStats();
        applyFilters();

        loading.style.display = 'none';
    } catch (error) {
        console.error('Error loading cars:', error);
        loading.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><h3 class="empty-title">Error Loading Cars</h3><p class="empty-subtitle">Please run: python max_scraper.py</p></div>';
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
        switch (sort) {
            case 'price-asc': return a.price - b.price;
            case 'price-desc': return b.price - a.price;
            case 'mileage': return a.mileage - b.mileage;
            case 'year': return b.year - a.year;
            default: return (b.dealScore || 0) - (a.dealScore || 0);
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
        showingCount.textContent = displayedCount;
        totalCount.textContent = filteredCars.length.toLocaleString();

        // Handle empty state
        if (filteredCars.length === 0) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
        }

        // Hide loader if no more items
        if (displayedCount >= filteredCars.length && scrollLoader) {
            scrollLoader.style.display = 'none';
        }

        isLoading = false;

        // Setup favorite buttons
        setupFavoriteButtons();
    });
}

function createCarCardHTML(car) {
    const isFav = favorites.has(car.id);
    const downPaymentAmount = car.price * 0.1; // 10% down
    const downPaymentText = formatCurrencyWhole(downPaymentAmount);
    const monthlyPayment = Math.round((car.price * 1.07) / 60);

    return `
      </button>
    </div>
  `;
}

function setupFavoriteButtons() {
    // Buttons are now handled inline with onclick
}

function toggleFavorite(id, btn) {
    if (favorites.has(id)) {
        favorites.delete(id);
        btn.classList.remove('active');
        btn.querySelector('svg').setAttribute('fill', 'none');
        btn.querySelector('svg').setAttribute('stroke', '#666');
    } else {
        favorites.add(id);
        btn.classList.add('active');
        btn.querySelector('svg').setAttribute('fill', '#ff4444');
        btn.querySelector('svg').setAttribute('stroke', '#ff4444');
    }
    localStorage.setItem('favorites', JSON.stringify([...favorites]));
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



