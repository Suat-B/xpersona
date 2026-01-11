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
        setupAnimations();
        setupParallax();
    } catch (error) {
        console.error('Error loading car details:', error);
    }
});

// Staggered content reveal animation with Apple-style easing
function setupAnimations() {
    const sections = document.querySelectorAll('.info-section, .quick-stats, .price-card, .contact-card, .dealer-card');
    sections.forEach((section, index) => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.willChange = 'opacity, transform';
        
        setTimeout(() => {
            section.style.transition = 'opacity 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), scale 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            requestAnimationFrame(() => {
                section.style.opacity = '1';
                section.style.transform = 'translateY(0) scale(1)';
                setTimeout(() => {
                    section.style.willChange = 'auto';
                }, 600);
            });
        }, index * 100);
    });
    
    // Animate gallery thumbnails with enhanced transitions
    const thumbs = document.querySelectorAll('.gallery-thumb');
    thumbs.forEach((thumb, index) => {
        thumb.style.opacity = '0';
        thumb.style.transform = 'scale(0.9) translateY(10px)';
        setTimeout(() => {
            thumb.style.transition = 'opacity 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            requestAnimationFrame(() => {
                thumb.style.opacity = '1';
                thumb.style.transform = 'scale(1) translateY(0)';
            });
        }, 400 + index * 30);
    });
    
    // Setup gallery image transitions
    setupGalleryTransitions();
}

// Enhanced gallery image transitions
function setupGalleryTransitions() {
    const mainImage = document.getElementById('main-image');
    const thumbs = document.querySelectorAll('.gallery-thumb');
    
    if (!mainImage || !thumbs.length) return;
    
    thumbs.forEach(thumb => {
        thumb.addEventListener('click', function() {
            const newSrc = this.src;
            if (mainImage.src === newSrc) return;
            
            // Smooth crossfade transition
            mainImage.style.opacity = '0';
            mainImage.style.transition = 'opacity 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            
            setTimeout(() => {
                mainImage.src = newSrc;
                requestAnimationFrame(() => {
                    mainImage.style.opacity = '1';
                });
            }, 150);
            
            // Update active thumbnail
            thumbs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// Enhanced parallax effect on scroll with smooth easing
function setupParallax() {
    const galleryWrapper = document.querySelector('.gallery-main-wrapper');
    const galleryImage = document.querySelector('.gallery-main-image');
    if (!galleryWrapper) return;

    let ticking = false;
    let lastScrollY = window.pageYOffset;
    
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                const scrolled = window.pageYOffset;
                const scrollDelta = scrolled - lastScrollY;
                const rate = scrolled * 0.2; // Reduced for subtler effect
                
                // Smooth parallax for gallery
                if (galleryWrapper && scrolled < galleryWrapper.offsetHeight) {
                    galleryWrapper.style.transform = `translateY(${rate}px)`;
                    galleryWrapper.style.transition = 'transform 0.1s ease-out';
                }
                
                // Subtle zoom effect on image
                if (galleryImage && scrolled < galleryWrapper.offsetHeight) {
                    const zoom = 1 + (scrolled * 0.0005);
                    galleryImage.style.transform = `scale(${Math.min(zoom, 1.1)})`;
                    galleryImage.style.transition = 'transform 0.1s ease-out';
                }
                
                lastScrollY = scrolled;
                ticking = false;
            });
            ticking = true;
        }
    });
    
    // Reset on scroll to top
    window.addEventListener('scroll', () => {
        if (window.pageYOffset === 0) {
            if (galleryWrapper) {
                galleryWrapper.style.transform = 'translateY(0)';
            }
            if (galleryImage) {
                galleryImage.style.transform = 'scale(1)';
            }
        }
    }, { passive: true });
}

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
    
    // Smooth page entrance with scale
    document.body.style.opacity = '0';
    document.body.style.transform = 'scale(0.98)';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            document.body.style.transition = 'opacity 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            document.body.style.opacity = '1';
            document.body.style.transform = 'scale(1)';
        });
    });

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

    // Down Payment Logic (15%)
    const downPaymentAmount = Math.round(price * 0.15);
    const downPaymentText = `$${downPaymentAmount.toLocaleString()}`;

    if (priceEl) {
        // We are hijacking the existing 'car-price' element to inject the new structure
        // ideally we would change the HTML structure but this is faster if we are careful

        // Find parent container to manipulate structure if needed
        const priceDisplay = priceEl.closest('.price-display');
        if (priceDisplay) {
            const label = priceDisplay.querySelector('.price-label');
            if (label) label.textContent = 'Estimated Down Payment';

            // Smooth price animation
            animatePrice(priceEl, 0, downPaymentAmount, 600);
            
            const subText = priceDisplay.querySelector('.price-full');
            if (subText) {
                subText.style.opacity = '0';
                subText.textContent = `Cash Price: $${price.toLocaleString()}`;
                setTimeout(() => {
                    subText.style.transition = 'opacity 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                    subText.style.opacity = '1';
                }, 100);
            }
        }
    }
}

// Smooth price animation
function animatePrice(element, start, end, duration) {
    if (!element) return;
    const startTime = performance.now();
    const startValue = start;
    const endValue = end;

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3); // Ease out cubic
        const current = Math.round(startValue + (endValue - startValue) * easeOut);
        element.textContent = `$${current.toLocaleString()}`;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = `$${endValue.toLocaleString()}`;
        }
    }
    
    requestAnimationFrame(update);

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

    // Main image with smooth transition and scale
    const mainImage = document.getElementById('main-image');
    if (mainImage) {
        mainImage.style.opacity = '0';
        mainImage.style.transform = 'scale(1.05)';
        mainImage.style.transition = 'opacity 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        mainImage.src = imageUrl;
        mainImage.alt = `${year} ${make} ${model}`;
        mainImage.onload = () => {
            requestAnimationFrame(() => {
                mainImage.style.opacity = '1';
                mainImage.style.transform = 'scale(1)';
            });
        };
        mainImage.onerror = () => {
            mainImage.src = 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800';
            mainImage.style.opacity = '1';
            mainImage.style.transform = 'scale(1)';
        };
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

    // Features grid (key highlights) with staggered animation
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
        featuresGrid.innerHTML = features.map((f, index) => `
            <div class="feature-item" style="opacity: 0; transform: translateY(10px) scale(0.95); transition: opacity 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${index * 60}ms, transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${index * 60}ms;">
                <div class="feature-icon">${f.icon}</div>
                <div class="feature-content">
                    <span class="feature-label">${f.label}</span>
                    <span class="feature-value">${f.value}</span>
                </div>
            </div>
        `).join('');
        
        // Trigger animations
        setTimeout(() => {
            const items = featuresGrid.querySelectorAll('.feature-item');
            items.forEach(item => {
                item.style.opacity = '1';
                item.style.transform = 'translateY(0) scale(1)';
            });
        }, 150);
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
        specsGrid.innerHTML = specs.map((s, index) => `
            <div class="overview-item" style="opacity: 0; transform: translateY(10px) scale(0.95); transition: opacity 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${index * 50}ms, transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${index * 50}ms;">
                <span class="overview-label">${s.label}</span>
                <span class="overview-value">${s.value}</span>
            </div>
        `).join('');
        
        // Trigger animations
        setTimeout(() => {
            const items = specsGrid.querySelectorAll('.overview-item');
            items.forEach(item => {
                item.style.opacity = '1';
                item.style.transform = 'translateY(0) scale(1)';
            });
        }, 250);
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

let currentImageIndex = 0;
let images = [];

function prevImage() {
    if (!images.length) return;
    currentImageIndex = (currentImageIndex - 1 + images.length) % images.length;
    updateGalleryImage();
}

function nextImage() {
    if (!images.length) return;
    currentImageIndex = (currentImageIndex + 1) % images.length;
    updateGalleryImage();
}

function updateGalleryImage() {
    const mainImage = document.getElementById('main-image');
    const thumbs = document.querySelectorAll('.gallery-thumb');
    
    if (!mainImage || !images[currentImageIndex]) return;
    
    // Smooth fade transition
    mainImage.style.transition = 'opacity 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    mainImage.style.opacity = '0';
    
    setTimeout(() => {
        mainImage.src = images[currentImageIndex];
        mainImage.style.opacity = '1';
    }, 150);
    
    // Update active thumbnail with smooth transition
    thumbs.forEach((thumb, index) => {
        thumb.style.transition = 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), border-color 0.2s';
        if (index === currentImageIndex) {
            thumb.classList.add('active');
            thumb.style.transform = 'scale(1.05)';
        } else {
            thumb.classList.remove('active');
            thumb.style.transform = 'scale(1)';
        }
    });
}

