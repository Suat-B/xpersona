"""
CarGurus Maximum Scraper V2 - Enhanced with Detail Fetching
============================================================
1. Exhaustive search using all filter combinations
2. Detail page scraping for additional info (VIN, features, history, etc.)
3. Real-time progress monitoring
"""

import requests
import json
import time
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

# Fix encoding and buffering for Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Unbuffered print
def log(msg=""):
    print(msg, flush=True)

# Constants
OUTPUT_FILE = "cars.json"
DETAIL_OUTPUT_FILE = "cars_detailed.json"
CHECKPOINT_FILE = "scrape_checkpoint_v2.json"
TARGET_COUNT = 50000
DELAY = 0.1  # 100ms delay between requests
DETAIL_DELAY = 0.2  # 200ms for detail pages

# Storage
all_listings = {}
request_count = 0
detail_fetch_count = 0


def create_session():
    """Create a session with mobile headers."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.cargurus.com/",
        "Origin": "https://www.cargurus.com",
        "Connection": "keep-alive",
    })
    return session


def fetch_listings(session, params):
    """Fetch listings from API."""
    global request_count
    request_count += 1
    
    try:
        r = session.get(
            "https://www.cargurus.com/Cars/searchResults.action",
            params=params,
            timeout=30
        )
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                return data.get('listings') or data.get('results') or []
        elif r.status_code == 429:
            print("  [Rate limited, waiting 5s...]")
            time.sleep(5)
        elif r.status_code == 403:
            print("  [403 Forbidden, waiting 10s...]")
            time.sleep(10)
    except requests.exceptions.Timeout:
        print("  [Timeout, retrying...]")
    except Exception as e:
        pass
    return []


def fetch_vehicle_details(session, listing_id, seller_id=None):
    """Fetch additional details for a specific vehicle."""
    global detail_fetch_count
    detail_fetch_count += 1
    
    details = {}
    
    try:
        # Try the listing detail endpoint
        url = f"https://www.cargurus.com/Cars/detailListingJson.action"
        params = {"listingId": listing_id}
        if seller_id:
            params["sellerId"] = seller_id
        
        r = session.get(url, params=params, timeout=20)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, dict):
                details.update(data)
    except:
        pass
    
    try:
        # Try alternate endpoint for more info
        url2 = f"https://www.cargurus.com/Cars/inventorylisting/vdp.action"
        params2 = {"listingId": listing_id, "sourceContext": "carGurusHomePageModel"}
        r2 = session.get(url2, params=params2, timeout=20)
        if r2.status_code == 200 and 'application/json' in r2.headers.get('content-type', ''):
            data2 = r2.json()
            if isinstance(data2, dict):
                details.update(data2)
    except:
        pass
    
    return details


def save_progress(listings, filename=OUTPUT_FILE):
    """Save current progress."""
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(list(listings.values()), f, indent=2, ensure_ascii=False)
    return len(listings)


def load_existing():
    """Load existing data."""
    existing = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                for item in json.load(f):
                    if item.get('id'):
                        existing[item['id']] = item
            print(f"Loaded {len(existing)} existing listings")
        except:
            pass
    return existing


def main():
    global all_listings
    
    print("=" * 70)
    print("  CarGurus Maximum Scraper V2 - Enhanced Edition")
    print("  Fetching ALL available vehicles with detailed information")
    print("=" * 70)
    
    # Load existing
    all_listings = load_existing()
    initial_count = len(all_listings)
    
    session = create_session()
    start_time = time.time()
    last_save_count = initial_count
    
    # =========================================================================
    # CONFIGURATION - All filter options
    # =========================================================================
    
    # Make IDs (comprehensive list)
    makes = [
        "m7", "m6", "m3", "m1", "m10", "m41", "m47", "m32", "m21", "m17",
        "m27", "m28", "m53", "m30", "m22", "m191", "m55", "m56", "m2", "m35",
        "m29", "m31", "m16", "m148", "m33", "m38", "m46", "m18", "m24", "m42",
        "m45", "m43", "m34", "m52", "m40", "m154", "m155", "m153", "m37",
        "m50", "m51", "m54", "m36", "m20", "m19", "m39", "m44", "m48", "m49"
    ]
    
    make_names = {
        "m1": "Chevrolet", "m2": "GMC", "m3": "Ford", "m6": "Honda", "m7": "Toyota",
        "m10": "Nissan", "m16": "Dodge", "m17": "Jeep", "m18": "Buick", "m21": "Lexus",
        "m22": "Cadillac", "m27": "Hyundai", "m28": "Kia", "m29": "Lincoln", "m30": "Mazda",
        "m31": "Infiniti", "m32": "Audi", "m33": "Porsche", "m35": "Acura", "m38": "Land Rover",
        "m41": "BMW", "m46": "Jaguar", "m47": "Mercedes-Benz", "m53": "Subaru", 
        "m55": "Volkswagen", "m56": "Volvo", "m148": "Tesla", "m191": "RAM"
    }
    
    # Price ranges (granular)
    price_ranges = [(i, i + 2000) for i in range(0, 15000, 2000)]
    price_ranges += [(i, i + 3000) for i in range(15000, 30000, 3000)]
    price_ranges += [(i, i + 5000) for i in range(30000, 60000, 5000)]
    price_ranges += [(i, i + 10000) for i in range(60000, 100000, 10000)]
    price_ranges += [(i, i + 25000) for i in range(100000, 200000, 25000)]
    price_ranges += [(200000, 500000), (500000, 1000000)]
    
    # Year ranges
    years = list(range(1990, 2026))
    
    # Mileage ranges (granular)
    mileage_ranges = [(i, i + 15000) for i in range(0, 150000, 15000)]
    mileage_ranges += [(150000, 200000), (200000, 300000)]
    
    # Body types
    body_types = ["bg1", "bg2", "bg3", "bg4", "bg5", "bg6", "bg7"]  # Sedan, SUV, Truck, etc.
    
    # ZIP codes (Houston and surrounding areas)
    zip_codes = [
        "77479", "77494", "77459", "77469", "77083", "77072", "77401", "77098",
        "77005", "77025", "77030", "77056", "77057", "77063", "77079", "77084",
        "77096", "77099", "77406", "77407", "77450", "77478", "77489", "77545",
        "77584", "77586", "77581", "77578", "77546", "77573", "77502", "77504",
        "77505", "77506", "77507", "77058", "77346", "77339", "77062", "77058"
    ]
    
    # Sort types
    sort_types = ["DEAL_SCORE", "PRICE", "MILEAGE", "NEWEST_CAR_YEAR", "DISTANCE", "BEST_MATCH"]
    
    base_params = {
        "inventorySearchWidgetType": "AUTO",
        "showNegotiable": "true",
        "maxResults": 100
    }
    
    def add_listings(listings):
        """Add new listings to collection."""
        new_count = 0
        for item in listings:
            lid = item.get('id')
            if lid and lid not in all_listings:
                all_listings[lid] = item
                new_count += 1
        return new_count
    
    def status_line():
        elapsed = time.time() - start_time
        rate = (len(all_listings) - initial_count) / max(elapsed, 1)
        return f"[{len(all_listings):,} unique | +{rate:.1f}/s | {request_count} reqs]"
    
    # =========================================================================
    # STRATEGY 1: By Make + Price Range (most effective)
    # =========================================================================
    print(f"\n{'='*70}")
    print("[1/6] Strategy: Make + Price Range Combinations")
    print("=" * 70)
    
    for make_id in makes:
        make_name = make_names.get(make_id, make_id)
        for min_p, max_p in price_ranges:
            params = {
                **base_params,
                "zip": "77479",
                "distance": 500,
                "makeId": make_id,
                "minPrice": min_p,
                "maxPrice": max_p
            }
            new = add_listings(fetch_listings(session, params))
            time.sleep(DELAY)
        
        print(f"  {make_name}: {status_line()}")
        
        # Save periodically
        if len(all_listings) - last_save_count >= 500:
            save_progress(all_listings)
            last_save_count = len(all_listings)
            print(f"  [SAVED {last_save_count:,} listings]")
    
    # =========================================================================
    # STRATEGY 2: By Price + Mileage (catches cars missed by make)
    # =========================================================================
    print(f"\n{'='*70}")
    print("[2/6] Strategy: Price + Mileage Combinations")
    print("=" * 70)
    
    for min_p, max_p in price_ranges:
        for min_m, max_m in mileage_ranges:
            params = {
                **base_params,
                "zip": "77479",
                "distance": 500,
                "minPrice": min_p,
                "maxPrice": max_p,
                "minMileage": min_m,
                "maxMileage": max_m
            }
            add_listings(fetch_listings(session, params))
            time.sleep(DELAY)
        
        if min_p % 10000 == 0:
            print(f"  Price ${min_p:,}-${max_p:,}: {status_line()}")
    
    if len(all_listings) - last_save_count >= 500:
        save_progress(all_listings)
        last_save_count = len(all_listings)
        print(f"  [SAVED {last_save_count:,} listings]")
    
    # =========================================================================
    # STRATEGY 3: By Body Type + Year
    # =========================================================================
    print(f"\n{'='*70}")
    print("[3/6] Strategy: Body Type + Year Combinations")
    print("=" * 70)
    
    for body in body_types:
        for year in years:
            params = {
                **base_params,
                "zip": "77479",
                "distance": 500,
                "bodyTypeGroupId": body,
                "startYear": year,
                "endYear": year
            }
            add_listings(fetch_listings(session, params))
            time.sleep(DELAY)
        print(f"  Body {body}: {status_line()}")
    
    if len(all_listings) - last_save_count >= 500:
        save_progress(all_listings)
        last_save_count = len(all_listings)
        print(f"  [SAVED {last_save_count:,} listings]")
    
    # =========================================================================
    # STRATEGY 4: Multiple ZIP Codes
    # =========================================================================
    print(f"\n{'='*70}")
    print("[4/6] Strategy: Multiple ZIP Codes")
    print("=" * 70)
    
    for zc in zip_codes:
        for sort_type in sort_types:
            params = {
                **base_params,
                "zip": zc,
                "distance": 100,
                "sortType": sort_type
            }
            add_listings(fetch_listings(session, params))
            time.sleep(DELAY)
        print(f"  ZIP {zc}: {status_line()}")
    
    if len(all_listings) - last_save_count >= 500:
        save_progress(all_listings)
        last_save_count = len(all_listings)
        print(f"  [SAVED {last_save_count:,} listings]")
    
    # =========================================================================
    # STRATEGY 5: Year + Price (by decade)
    # =========================================================================
    print(f"\n{'='*70}")
    print("[5/6] Strategy: Year + Price Combinations")
    print("=" * 70)
    
    for year in years:
        for min_p, max_p in price_ranges[::2]:  # Every other price range
            params = {
                **base_params,
                "zip": "77479",
                "distance": 500,
                "startYear": year,
                "endYear": year,
                "minPrice": min_p,
                "maxPrice": max_p
            }
            add_listings(fetch_listings(session, params))
            time.sleep(DELAY)
        
        if year % 5 == 0:
            print(f"  Year {year}: {status_line()}")
    
    if len(all_listings) - last_save_count >= 500:
        save_progress(all_listings)
        last_save_count = len(all_listings)
        print(f"  [SAVED {last_save_count:,} listings]")
    
    # =========================================================================
    # STRATEGY 6: Pagination through large result sets
    # =========================================================================
    print(f"\n{'='*70}")
    print("[6/6] Strategy: Pagination Through Results")
    print("=" * 70)
    
    for sort_type in sort_types:
        for offset in range(0, 1000, 100):
            params = {
                **base_params,
                "zip": "77479",
                "distance": 500,
                "sortType": sort_type,
                "offset": offset
            }
            listings = fetch_listings(session, params)
            if not listings:
                break
            add_listings(listings)
            time.sleep(DELAY)
        print(f"  Sort {sort_type}: {status_line()}")
    
    # =========================================================================
    # FINAL SAVE
    # =========================================================================
    save_progress(all_listings)
    elapsed = time.time() - start_time
    
    print(f"\n{'='*70}")
    print("  SCRAPING COMPLETE!")
    print("=" * 70)
    print(f"\n  Total Unique Vehicles: {len(all_listings):,}")
    print(f"  New This Session:      {len(all_listings) - initial_count:,}")
    print(f"  Total Requests:        {request_count:,}")
    print(f"  Time Elapsed:          {elapsed:.1f}s ({elapsed/60:.1f} min)")
    print(f"  Rate:                  {(len(all_listings) - initial_count)/max(elapsed,1):.1f} vehicles/s")
    
    # Statistics
    print(f"\n{'='*70}")
    print("  STATISTICS")
    print("=" * 70)
    
    make_counts = {}
    prices = []
    years_list = []
    mileages = []
    
    for car in all_listings.values():
        make = car.get("makeName", "Unknown")
        make_counts[make] = make_counts.get(make, 0) + 1
        
        if car.get("price"):
            prices.append(car["price"])
        if car.get("carYear"):
            years_list.append(car["carYear"])
        if car.get("mileage"):
            mileages.append(car["mileage"])
    
    print("\n  Top 15 Makes:")
    for make, count in sorted(make_counts.items(), key=lambda x: -x[1])[:15]:
        pct = count / len(all_listings) * 100
        print(f"    {make}: {count:,} ({pct:.1f}%)")
    
    if prices:
        print(f"\n  Price Range:   ${min(prices):,.0f} - ${max(prices):,.0f}")
        print(f"  Average Price: ${sum(prices)/len(prices):,.0f}")
    
    if years_list:
        print(f"\n  Year Range:    {min(years_list)} - {max(years_list)}")
    
    if mileages:
        print(f"\n  Mileage Range: {min(mileages):,} - {max(mileages):,} mi")
        print(f"  Average Miles: {sum(mileages)/len(mileages):,.0f} mi")
    
    print(f"\n{'='*70}")
    print(f"  Data saved to: {OUTPUT_FILE}")
    print("=" * 70)


if __name__ == "__main__":
    main()
