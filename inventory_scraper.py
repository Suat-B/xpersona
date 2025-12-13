"""
CarGurus Inventory Scraper - Using getFilteredInventoryListing API
This endpoint supports proper pagination
"""

import requests
import json
import time
import os
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

OUTPUT_FILE = "cars.json"
all_listings = {}


def load_existing():
    global all_listings
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, encoding='utf-8') as f:
                for l in json.load(f):
                    if l.get('id'):
                        all_listings[l['id']] = l
            print(f"Loaded {len(all_listings)} existing listings")
        except:
            pass


def save_listings():
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(list(all_listings.values()), f)
    return len(all_listings)


def scrape_page(session, offset=0, filters=None):
    """Scrape a page of listings."""
    base_url = "https://www.cargurus.com/Cars/getFilteredInventoryListing.action"
    
    params = {
        "zip": "77479",
        "carType": "USED",
        "offset": offset,
        "maxResults": 100,
        "sortType": "DEAL_SCORE",
        "distance": 500,
        "filtersModified": "true"
    }
    
    if filters:
        params.update(filters)
    
    try:
        r = session.get(base_url, params=params, timeout=30)
        if r.status_code == 200:
            data = r.json()
            # This endpoint returns a dict with 'listings' key
            if isinstance(data, dict):
                return data.get('listings') or data.get('results') or []
            elif isinstance(data, list):
                return data
    except Exception as e:
        print(f"Error at offset {offset}: {e}")
    return []


def main():
    print("=" * 60)
    print("CarGurus Inventory Scraper - Granular Mode")
    print("Target: 46,837+ listings")
    print("=" * 60)
    
    load_existing()
    initial = len(all_listings)
    print(f"Starting with {initial} listings")
    
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action"
    })
    
    start = time.time()
    last_save = initial
    
    # Generate granular filter sets
    filter_sets = []
    
    # 1. Very granular price ranges (every $1000 up to $50k, then $2k up to $100k)
    # This helps break down the large bulk of inventory
    for min_p in range(0, 50000, 1000):
        filter_sets.append({"minPrice": min_p, "maxPrice": min_p + 1000})
    for min_p in range(50000, 100000, 2500):
        filter_sets.append({"minPrice": min_p, "maxPrice": min_p + 2500})
    for min_p in range(100000, 200000, 10000):
        filter_sets.append({"minPrice": min_p, "maxPrice": min_p + 10000})
    filter_sets.append({"minPrice": 200000})
        
    # 2. Year + Make combinations for popular makes
    # This targets specific high-volume segments
    popular_makes = ["m7", "m6", "m3", "m1", "m10", "m41", "m47", "m32", "m21", "m17", "m191", "m53", "m27", "m28"]
    years = range(2015, 2026) # Focus on newer cars which are more plentiful
    
    for make in popular_makes:
        for year in years:
            filter_sets.append({"makeId": make, "startYear": year, "endYear": year})
            
    # 3. Mileage ranges (granular)
    for min_m in range(0, 150000, 5000):
        filter_sets.append({"minMileage": min_m, "maxMileage": min_m + 5000})
        
    # 4. Body Type + Price (broad buckets)
    body_types = ["bg5", "bg6", "bg7", "bg1", "bg2"] # Truck, Sedan, SUV, Coupe, Convertible
    price_buckets = [(0, 15000), (15000, 30000), (30000, 50000), (50000, 100000)]
    
    for body in body_types:
        for min_p, max_p in price_buckets:
            filter_sets.append({"bodyTypeGroupId": body, "minPrice": min_p, "maxPrice": max_p})

    print(f"Generated {len(filter_sets)} granular filter sets to process")
    
    # Process filters
    for i, filters in enumerate(filter_sets):
        # Progress indicator
        if i % 10 == 0:
            print(f"Processing filter set {i+1}/{len(filter_sets)}...")
            
        # Pagination for each filter
        # We assume granular filters won't have > 1000 results usually, but we check
        for offset in range(0, 2000, 100):
            listings = scrape_page(session, offset, filters)
            
            if not listings:
                break
                
            new_count = 0
            for l in listings:
                lid = l.get('id')
                if lid and lid not in all_listings:
                    all_listings[lid] = l
                    new_count += 1
            
            # If we got results but no NEW ones, and we're deep in pagination, maybe skip
            if len(listings) > 0 and new_count == 0 and offset > 500:
                break
                
            # Periodic save
            if len(all_listings) - last_save >= 500:
                save_listings()
                last_save = len(all_listings)
                print(f"  [Saved {last_save} listings total]")
                
            time.sleep(0.1) # Fast but polite
            
            if len(listings) < 100: # End of results for this filter
                break
                
    # Final save
    final = save_listings()
    elapsed = time.time() - start
    
    print(f"\n{'=' * 60}")
    print(f"COMPLETE: {final} listings scraped in {elapsed/60:.1f} minutes")
    print(f"{'=' * 60}")
    
    # Stats
    makes_count = {}
    for l in all_listings.values():
        m = l.get("makeName", "Unknown")
        makes_count[m] = makes_count.get(m, 0) + 1
    
    print("\nTop 15 Makes:")
    for m, c in sorted(makes_count.items(), key=lambda x: -x[1])[:15]:
        print(f"  {m}: {c}")


if __name__ == "__main__":
    main()
