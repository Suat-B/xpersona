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
    document.title = `${year} ${make} ${model} - xpersona`;

    // Breadcrumb
    const breadcrumbTitle = document.getElementById('breadcrumb-title');
    if (breadcrumbTitle) {
        breadcrumbTitle.textContent = `${year} ${make} ${model}`;
    }

    // Car title
    document.getElementById('car-title').textContent = `${year} ${make} ${model} ${trim}`;

    // Location
    const locationEl = document.getElementById('car-location');
    if (locationEl) {
        locationEl.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
            </svg>
            <span>${city} • ${distance.toFixed(1)} mi away</span>
        `;
    }

    // Price
    const downPayment = Math.round(price * 0.1);
    const priceEl = document.getElementById('car-price');
    if (priceEl) {
        priceEl.innerHTML = `
            <div class="price-main">
                <span class="price-label">Down Payment</span>
                <span class="price-amount">$${downPayment.toLocaleString()}</span>
            </div>
            <div class="price-full">Full Price: $${price.toLocaleString()}</div>
        `;
    }

    // Deal badge
    const dealRating = formatDealRating(car.dealRating);
    const dealBadge = document.getElementById('deal-badge');
    const dealText = document.getElementById('deal-text');

    if (dealText) {
        dealText.textContent = dealRating;
    }

    // Update deal indicator styling based on rating
    if (dealBadge) {
        dealBadge.className = 'deal-indicator';
        if (dealRating === 'Great Deal' || dealRating === 'Good Deal') {
            dealBadge.style.background = 'rgba(16, 185, 129, 0.1)';
            dealBadge.querySelector('.deal-dot').style.background = '#10b981';
            dealBadge.querySelector('.deal-rating').style.color = '#10b981';
        } else if (dealRating === 'Fair Deal') {
            dealBadge.style.background = 'rgba(245, 158, 11, 0.1)';
            dealBadge.querySelector('.deal-dot').style.background = '#f59e0b';
            dealBadge.querySelector('.deal-rating').style.color = '#f59e0b';
        } else {
            dealBadge.style.background = 'rgba(239, 68, 68, 0.1)';
            dealBadge.querySelector('.deal-dot').style.background = '#ef4444';
            dealBadge.querySelector('.deal-rating').style.color = '#ef4444';
        }
    }

    // Gallery badge
    const galleryBadge = document.getElementById('gallery-badge');
    if (galleryBadge) {
        galleryBadge.textContent = dealRating;
    }

    // Market comparison
    const diff = car.priceDifferential || 0;
    const marketEl = document.getElementById('market-comparison');
    if (marketEl) {
        if (diff > 0) {
            marketEl.textContent = `$${Math.round(diff).toLocaleString()} below market average`;
        } else if (diff < 0) {
            marketEl.textContent = `$${Math.abs(Math.round(diff)).toLocaleString()} above market average`;
        } else {
            marketEl.textContent = 'At market price';
        }
    }

    // Main image
    const mainImage = document.getElementById('main-image');
    if (mainImage) {
        mainImage.src = imageUrl;
        mainImage.alt = `${year} ${make} ${model}`;
    }

    // Quick stats
    document.getElementById('stat-mileage').textContent = mileage.toLocaleString();
    document.getElementById('stat-drivetrain').textContent = car.localizedDriveTrain || car.drivetrain || 'FWD';
    document.getElementById('stat-fuel').textContent = car.localizedFuelType || car.fuelType || 'Gasoline';
    document.getElementById('stat-transmission').textContent = (car.localizedTransmission || car.transmission || 'Automatic').split(' ')[0];

    // Dealer info
    const dealerName = car.serviceProviderName || car.dealerName || car.dealer?.name || 'Premium Auto';
    const dealerRating = car.sellerRating || car.dealer?.rating || 4.5;
    const reviewCount = car.reviewCount || car.dealer?.reviews || 0;

    document.getElementById('dealer-name').textContent = dealerName;

    const dealerRatingEl = document.getElementById('dealer-rating');
    if (dealerRatingEl) {
        const fullStars = Math.floor(dealerRating);
        const stars = '★'.repeat(fullStars) + '☆'.repeat(5 - fullStars);
        dealerRatingEl.innerHTML = `
            <span class="stars">${stars}</span>
            <span class="review-count">(${reviewCount} reviews)</span>
        `;
    }

    // Features grid
    const features = [
        { icon: '🛣️', label: 'Mileage', value: `${mileage.toLocaleString()} mi` },
        { icon: '⚙️', label: 'Drivetrain', value: car.localizedDriveTrain || car.drivetrain || 'FWD' },
        { icon: '🎨', label: 'Exterior', value: car.localizedExteriorColor || car.exteriorColor || 'Unknown' },
        { icon: '💺', label: 'Interior', value: car.localizedInteriorColor || car.interiorColor || 'Unknown' },
        { icon: '🔧', label: 'Engine', value: car.localizedEngineDisplayName || 'N/A' },
        { icon: '⛽', label: 'Fuel', value: car.localizedFuelType || car.fuelType || 'Gasoline' },
        { icon: '🔄', label: 'Transmission', value: car.localizedTransmission || car.transmission || 'Automatic' },
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

    // Overview/Specs grid
    const overview = [
        { label: 'Make', value: make },
        { label: 'Model', value: model },
        { label: 'Year', value: year },
        { label: 'Trim', value: trim || 'Base' },
        { label: 'Body Type', value: car.bodyTypeName || car.bodyType || 'Sedan' },
        { label: 'Exterior Color', value: car.localizedExteriorColor || car.exteriorColor || 'Unknown' },
        { label: 'Interior Color', value: car.localizedInteriorColor || car.interiorColor || 'Unknown' },
        { label: 'Mileage', value: `${mileage.toLocaleString()} mi` },
        { label: 'Condition', value: 'Pre-Owned' },
        { label: 'VIN', value: car.vin || 'Available on Request' },
        { label: 'Stock #', value: car.stockNumber || 'N/A' },
        { label: 'Days Listed', value: car.daysOnMarket || 'New' }
    ];

    const overviewGrid = document.getElementById('overview-grid');
    if (overviewGrid) {
        overviewGrid.innerHTML = overview.map(o => `
            <div class="overview-item">
                <span class="overview-label">${o.label}</span>
                <span class="overview-value">${o.value}</span>
            </div>
        `).join('');
    }
}

function formatDealRating(rating) {
    if (!rating) return 'Analyzing Price';
    const map = {
        'GREAT_PRICE': 'Great Deal',
        'GOOD_PRICE': 'Good Deal',
        'FAIR_PRICE': 'Fair Deal',
        'HIGH_PRICE': 'Above Market',
        'OVERPRICED': 'Overpriced'
    };
    return map[rating] || rating.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
