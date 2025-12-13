"""
CarGurus MEGA Scraper - Full Inventory (46,837+ listings)
Uses exhaustive filter combinations with rate limiting
"""

import requests
import json
import time
import os
import sys

# Fix encoding for Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Constants
OUTPUT_FILE = "cars.json"
CHECKPOINT_FILE = "scrape_checkpoint.json"
TARGET_COUNT = 50000
DELAY = 0.1  # 100ms delay between requests

# Storage
all_listings = {}
request_count = 0


def get_session():
    """Create a session with mobile headers."""
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.cargurus.com/",
    })
    return session


def fetch(session, params):
    """Fetch listings."""
    global request_count
    request_count += 1
    
    try:
        r = session.get("https://www.cargurus.com/Cars/searchResults.action", params=params, timeout=20)
        if r.status_code == 200:
            data = r.json()
            return data if isinstance(data, list) else (data.get('listings') or data.get('results') or [])
        elif r.status_code == 429:
            time.sleep(3)
        elif r.status_code == 403:
            time.sleep(5)
    except:
        pass
    return []


def save():
    """Save current progress."""
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(list(all_listings.values()), f)
    return len(all_listings)


def load():
    """Load existing data."""
    global all_listings
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
                for l in json.load(f):
                    if l.get('id'):
                        all_listings[l['id']] = l
            print(f"Loaded {len(all_listings)} existing listings")
        except:
            pass


def main():
    print("=" * 60)
    print("CarGurus MEGA Scraper")
    print("=" * 60)
    
    load()
    initial = len(all_listings)
    session = get_session()
    start = time.time()
    last_save = initial
    
    # All makes
    makes = [
        "m7", "m6", "m3", "m1", "m10", "m41", "m47", "m32", "m21", "m17",
        "m27", "m28", "m53", "m30", "m22", "m191", "m55", "m56", "m2", "m35",
        "m29", "m31", "m16", "m148", "m33", "m38", "m46", "m18", "m24", "m42",
        "m45", "m43", "m34", "m52", "m40", "m154", "m155", "m153"
    ]
    
    # Price ranges
    prices = [(i, i+3000) for i in range(0, 15000, 3000)]
    prices += [(i, i+5000) for i in range(15000, 50000, 5000)]
    prices += [(i, i+10000) for i in range(50000, 100000, 10000)]
    prices += [(i, i+25000) for i in range(100000, 250000, 25000)]
    prices += [(250000, 1000000)]
    
    # Years
    years = list(range(2000, 2026))
    
    # Mileage
    miles = [(i, i+20000) for i in range(0, 200000, 20000)]
    
    # Body types
    bodies = ["bg5", "bg6", "bg7", "bg1", "bg2", "bg3", "bg4"]
    
    base = {"zip": "77479", "inventorySearchWidgetType": "AUTO", "distance": 500, "maxResults": 100}
    
    batch = 0
    total_batches = len(makes) * len(prices) + len(prices) * len(miles) + len(bodies) * len(years)
    
    # Strategy 1: Make + Price
    print("\n[1/3] Scraping by Make + Price...")
    for make in makes:
        for min_p, max_p in prices:
            params = {**base, "makeId": make, "minPrice": min_p, "maxPrice": max_p}
            for l in fetch(session, params):
                if l.get('id') and l['id'] not in all_listings:
                    all_listings[l['id']] = l
            
            batch += 1
            if batch % 100 == 0:
                n = len(all_listings)
                elapsed = time.time() - start
                print(f"  Batch {batch}/{total_batches}: {n} listings ({(n-initial)/max(elapsed,1):.1f}/s)")
                
            if len(all_listings) - last_save >= 1000:
                save()
                last_save = len(all_listings)
                print(f"  [Saved {last_save}]")
            
            time.sleep(DELAY)
            
            if len(all_listings) >= TARGET_COUNT:
                break
        if len(all_listings) >= TARGET_COUNT:
            break
    
    # Strategy 2: Price + Mileage
    if len(all_listings) < TARGET_COUNT:
        print("\n[2/3] Scraping by Price + Mileage...")
        for min_p, max_p in prices:
            for min_m, max_m in miles:
                params = {**base, "minPrice": min_p, "maxPrice": max_p, "minMileage": min_m, "maxMileage": max_m}
                for l in fetch(session, params):
                    if l.get('id') and l['id'] not in all_listings:
                        all_listings[l['id']] = l
                
                batch += 1
                if batch % 100 == 0:
                    n = len(all_listings)
                    print(f"  Batch {batch}: {n} listings")
                    
                if len(all_listings) - last_save >= 1000:
                    save()
                    last_save = len(all_listings)
                    print(f"  [Saved {last_save}]")
                
                time.sleep(DELAY)
                
                if len(all_listings) >= TARGET_COUNT:
                    break
            if len(all_listings) >= TARGET_COUNT:
                break
    
    # Strategy 3: Body + Year
    if len(all_listings) < TARGET_COUNT:
        print("\n[3/3] Scraping by Body Type + Year...")
        for body in bodies:
            for year in years:
                params = {**base, "bodyTypeGroupId": body, "startYear": year, "endYear": year}
                for l in fetch(session, params):
                    if l.get('id') and l['id'] not in all_listings:
                        all_listings[l['id']] = l
                
                batch += 1
                if batch % 50 == 0:
                    n = len(all_listings)
                    print(f"  Batch {batch}: {n} listings")
                    
                if len(all_listings) - last_save >= 1000:
                    save()
                    last_save = len(all_listings)
                    print(f"  [Saved {last_save}]")
                
                time.sleep(DELAY)
                
                if len(all_listings) >= TARGET_COUNT:
                    break
            if len(all_listings) >= TARGET_COUNT:
                break
    
    # Final save
    final = save()
    elapsed = time.time() - start
    
    print(f"\n{'=' * 60}")
    print(f"DONE! {final} unique listings in {elapsed:.1f}s")
    print(f"{'=' * 60}")
    
    # Stats
    makes_count = {}
    prices_list = []
    for l in all_listings.values():
        m = l.get("makeName", "?")
        makes_count[m] = makes_count.get(m, 0) + 1
        if l.get("price"):
            prices_list.append(l["price"])
    
    print("\nTop Makes:")
    for m, c in sorted(makes_count.items(), key=lambda x: -x[1])[:10]:
        print(f"  {m}: {c}")
    
    if prices_list:
        print(f"\nPrice: ${min(prices_list):,.0f} - ${max(prices_list):,.0f}")


if __name__ == "__main__":
    main()
