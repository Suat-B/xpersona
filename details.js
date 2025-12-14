/**
 * xpersona - Modern Details Page JavaScript
 */

let car = null;

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const carId = params.get('id');

    if (!carId) {
        window.location.href = 'index.html';
        return;
    }

    try {
        const response = await fetch('cars.json');
        const cars = await response.json();
        car = cars.find(c => String(c.id) === carId);

        if (!car) {
            window.location.href = 'index.html';
            return;
        }

        renderCarDetails();
    } catch (error) {
        console.error('Error loading car details:', error);
    }
});

function renderCarDetails() {
    // Normalize data
    const year = car.carYear || car.year || 2020;
    const make = car.makeName || car.make || 'Unknown';
    const model = car.modelName || car.model || 'Unknown';
    const trim = car.trimName || car.trim || '';
    const price = car.price || 0;
    const mileage = car.mileage || 0;
    const city = car.sellerCity || car.location?.city || 'Houston, TX';
    const distance = car.distance || car.location?.distance || 0;
    const imageUrl = car.originalPictureData?.url || car.imageUrl || 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800';

    // Page title
    document.title = `${year} ${make} ${model} | xpersona`;

    // Breadcrumb
    const breadcrumbModel = document.getElementById('breadcrumb-model');
    if (breadcrumbModel) {
        breadcrumbModel.textContent = `${year} ${make} ${model}`;
    }

    // Car title
    const carTitle = document.getElementById('car-title');
    if (carTitle) carTitle.textContent = `${year} ${make} ${model} ${trim}`;

    // Location
    const locationEl = document.getElementById('car-location');
    if (locationEl) {
        locationEl.textContent = `${city} • ${distance.toFixed(1)} mi away`;
    }

    // Price
    const priceEl = document.getElementById('car-price');
    if (priceEl) {
        priceEl.textContent = `$${price.toLocaleString()}`;
    }

    // Deal Rating Logic
    const dealRating = formatDealRating(car.dealRating);

    // 1. Sidebar Rating Text
    const dealText = document.getElementById('deal-rating-text');
    if (dealText) {
        dealText.textContent = dealRating;
        // Optional: colorize text based on rating
        if (dealRating.includes('Great') || dealRating.includes('Good')) {
            dealText.style.color = 'var(--success)';
        } else if (dealRating.includes('Fair')) {
            dealText.style.color = 'var(--warning)';
        } else {
            dealText.style.color = 'var(--text-secondary)';
        }
    }

    // 2. Gallery Overlay Badge
    const galleryBadge = document.getElementById('gallery-deal-badge');
    if (galleryBadge) {
        galleryBadge.textContent = dealRating;
        // Simple color logic for badge
        if (dealRating === 'Great Deal') galleryBadge.style.color = 'var(--success)';
        else if (dealRating === 'Good Deal') galleryBadge.style.color = 'var(--success)';
        else if (dealRating === 'Fair Deal') galleryBadge.style.color = 'var(--warning)';
        else galleryBadge.style.color = 'var(--text-secondary)';
    }

    // Market Note
    const diff = car.priceDifferential || 0;
    const marketEl = document.getElementById('market-note');
    if (marketEl) {
        if (diff > 0) {
            marketEl.textContent = `$${Math.round(diff).toLocaleString()} below market average`;
            marketEl.style.color = 'var(--success)';
        } else if (diff < 0) {
            marketEl.textContent = `$${Math.abs(Math.round(diff)).toLocaleString()} above market average`;
            marketEl.style.color = 'var(--text-muted)';
        } else {
            marketEl.textContent = 'Priced at market average';
        }
    }

    // Main image
    const mainImage = document.getElementById('main-image');
    if (mainImage) {
        mainImage.src = imageUrl;
        mainImage.alt = `${year} ${make} ${model}`;
    }

    // Quick stats safely
    safeSetText('stat-mileage', mileage.toLocaleString());
    safeSetText('stat-transmission', (car.localizedTransmission || car.transmission || 'Auto').split(' ')[0]);
    safeSetText('stat-drivetrain', car.localizedDriveTrain || car.drivetrain || 'FWD');
    safeSetText('stat-engine', (car.localizedEngineDisplayName || 'V6').split(' ')[0]);

    // Dealer info
    const dealerName = car.serviceProviderName || car.dealerName || car.dealer?.name || 'Authorized Dealer';
    const reviewCount = car.reviewCount || car.dealer?.reviews || 24;

    safeSetText('dealer-name', dealerName);

    // Features grid (key highlights)
    const features = [
        { icon: '🛣️', label: 'Mileage', value: `${mileage.toLocaleString()} mi` },
        { icon: '⚙️', label: 'Drivetrain', value: car.localizedDriveTrain || car.drivetrain || 'FWD' },
        { icon: '🎨', label: 'Exterior', value: car.localizedExteriorColor || car.exteriorColor || 'N/A' },
        { icon: '💺', label: 'Interior', value: car.localizedInteriorColor || car.interiorColor || 'N/A' },
        { icon: '🔧', label: 'Engine', value: car.localizedEngineDisplayName || 'N/A' },
        { icon: '⛽', label: 'Fuel', value: car.localizedFuelType || car.fuelType || 'Gasoline' },
        { icon: '🔄', label: 'Transmission', value: car.localizedTransmission || car.transmission || 'Auto' },
        { icon: '🚗', label: 'Body', value: car.bodyTypeName || car.bodyType || 'Sedan' }
    ];

    const featuresGrid = document.getElementById('features-grid');
    if (featuresGrid) {
        featuresGrid.innerHTML = features.map(f => `
            <div class="feature-item">
                <div class="feature-icon">${f.icon}</div>
                <div class="feature-content">
                    <span class="feature-label">${f.label}</span>
                    <span class="feature-value">${f.value}</span>
                </div>
            </div>
        `).join('');
    }

    // Specs Grid (Detailed)
    const specs = [
        { label: 'Make', value: make },
        { label: 'Model', value: model },
        { label: 'Year', value: year },
        { label: 'Trim', value: trim || 'Base' },
        { label: 'Body Style', value: car.bodyTypeName || car.bodyType || 'Sedan' },
        { label: 'Ext. Color', value: car.localizedExteriorColor || 'Unknown' },
        { label: 'Int. Color', value: car.localizedInteriorColor || 'Unknown' },
        { label: 'Stock #', value: car.stockNumber || 'N/A' },
        { label: 'VIN', value: car.vin || 'Call for VIN' },
        { label: 'Days Listed', value: car.daysOnMarket || 'Just Listed' }
    ];

    const specsGrid = document.getElementById('specs-grid'); // ID updated to match HTML
    if (specsGrid) {
        specsGrid.innerHTML = specs.map(s => `
            <div class="overview-item">
                <span class="overview-label">${s.label}</span>
                <span class="overview-value">${s.value}</span>
            </div>
        `).join('');
    }
}

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function formatDealRating(rating) {
    if (!rating) return 'Market Prime';
    const map = {
        'GREAT_PRICE': 'Great Deal',
        'GOOD_PRICE': 'Good Deal',
        'FAIR_PRICE': 'Fair Deal',
        'HIGH_PRICE': 'High Price',
        'OVERPRICED': 'Overpriced'
    };
    return map[rating] || rating.replace(/_/g, ' ');
}

// Action Placeholders
function shareCar() {
    alert('Link copied to clipboard!');
}

function prevImage() {
    // Placeholder for gallery logic
    console.log('Previous image');
}

function nextImage() {
    // Placeholder for gallery logic
    console.log('Next image');
}

