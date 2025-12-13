"""
CarGurus Final Scraper - The Slicer Strategy
Uses searchResults.action (limit 48) with highly granular filters to slice the inventory.
Target: 46,837+ listings
"""

import requests
import json
import time
import os
import sys

# Fix encoding
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

def fetch_listings(session, params):
    url = "https://www.cargurus.com/Cars/searchResults.action"
    try:
        r = session.get(url, params=params, timeout=15)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list):
                return data
            return []
        elif r.status_code == 429:
            time.sleep(2)
    except:
        pass
    return []

def main():
    print("=" * 60)
    print("CarGurus Final Scraper - Slicer Strategy")
    print("Target: 46,837+ listings")
    print("=" * 60)
    
    load_existing()
    initial = len(all_listings)
    
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest"
    })
    
    # Generate granular filters
    # We need to slice the data so small that each slice has < 48 cars
    
    makes = [
        "m7", "m6", "m3", "m1", "m10", "m41", "m47", "m32", "m21", "m17",
        "m27", "m28", "m53", "m30", "m22", "m191", "m55", "m56", "m2", "m35",
        "m29", "m31", "m16", "m148", "m33", "m38", "m46", "m18", "m24", "m42"
    ]
    
    years = range(2010, 2026)
    
    # Price buckets: $5k increments
    prices = []
    for p in range(0, 100000, 5000):
        prices.append((p, p + 5000))
    prices.append((100000, 500000))
    
    # Base params
    base_params = {
        "zip": "77479",
        "inventorySearchWidgetType": "AUTO",
        "distance": 500,
        "maxResults": 100, # Request 100, get 48
        "sortType": "DEAL_SCORE"
    }
    
    start = time.time()
    last_save = initial
    
    # Total combinations
    total_combos = len(makes) * len(years) * len(prices)
    print(f"Processing {total_combos} filter combinations...")
    
    count = 0
    
    # Iterate
    for make in makes:
        for year in years:
            for min_p, max_p in prices:
                count += 1
                
                params = base_params.copy()
                params.update({
                    "makeId": make,
                    "startYear": year,
                    "endYear": year,
                    "minPrice": min_p,
                    "maxPrice": max_p
                })
                
                listings = fetch_listings(session, params)
                
                new_in_batch = 0
                for l in listings:
                    lid = l.get('id')
                    if lid and lid not in all_listings:
                        all_listings[lid] = l
                        new_in_batch += 1
                
                # Progress
                if count % 100 == 0:
                    elapsed = time.time() - start
                    rate = (len(all_listings) - initial) / max(elapsed, 1)
                    print(f"Progress: {count}/{total_combos} reqs | Total: {len(all_listings)} (+{len(all_listings)-initial}) | Rate: {rate:.1f}/s")
                
                # Save periodically
                if len(all_listings) - last_save >= 500:
                    save_listings()
                    last_save = len(all_listings)
                    print(f"  [Saved {last_save}]")
                
                # Polite delay
                time.sleep(0.05)
                
    final = save_listings()
    print(f"\nDONE! {final} listings saved.")

if __name__ == "__main__":
    main()
