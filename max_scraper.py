"""
CarGurus Maximum Scraper - All Strategies Combined
"""

import requests
import json
import time

def scrape_comprehensive(zip_code="77479"):
    """Comprehensive scraper using all available strategies."""
    
    print("=" * 60)
    print("CarGurus Maximum Scraper")
    print("Using ALL available strategies")
    print("=" * 60)
    
    session = requests.Session()
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.cargurus.com/",
    }
    session.headers.update(headers)
    
    all_listings = {}
    
    # Strategy 1: Different endpoints
    endpoints = [
        f"https://www.cargurus.com/Cars/searchResults.action",
        f"https://www.cargurus.com/Cars/getFilteredInventoryListing.action",
    ]
    
    # Strategy 2: Multiple sort types
    sort_types = ["DEAL_SCORE", "PRICE", "MILEAGE", "NEWEST_CAR_YEAR", "DISTANCE", 
                  "BEST_MATCH", "OLDEST_CAR_YEAR", "DEAL_RATING"]
    
    # Strategy 3: Price ranges (more granular)
    price_ranges = []
    for i in range(0, 200000, 5000):
        price_ranges.append((i, i + 5000))
    price_ranges.append((200000, 500000))
    price_ranges.append((500000, 1000000))
    
    # Strategy 4: Year ranges
    year_ranges = [(y, y) for y in range(2010, 2026)]
    
    # Strategy 5: Mileage ranges
    mileage_ranges = [(0, 20000), (20000, 40000), (40000, 60000), (60000, 80000),
                      (80000, 100000), (100000, 150000), (150000, 200000)]
    
    # Strategy 6: Body types
    body_types = ["bg5", "bg6", "bg7", "bg1", "bg2", "bg3", "bg4"]  # Truck, Sedan, SUV, etc.
    
    # Strategy 7: Transmission types
    trans_types = ["AUTOMATIC", "MANUAL", "CVT"]
    
    # Strategy 8: Drive types
    drive_types = ["AWD", "FWD", "RWD", "4WD"]
    
    # Strategy 9: Multiple ZIP codes in greater Houston area
    zip_codes = [
        "77479", "77494", "77459", "77469", "77083", "77072", "77401", "77098", 
        "77005", "77025", "77030", "77056", "77057", "77063", "77079", "77084",
        "77096", "77099", "77406", "77407", "77450", "77478", "77489", "77545",
        "77584", "77586", "77581", "77578", "77546", "77573"
    ]
    
    def fetch_listings(params):
        try:
            base_url = "https://www.cargurus.com/Cars/searchResults.action"
            response = session.get(base_url, params=params, timeout=30)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    return data.get('listings') or data.get('results') or []
        except:
            pass
        return []
    
    # Execute all strategies
    print("\n[1/6] By sort type and ZIP codes...")
    for zc in zip_codes[:15]:  # First 15 zip codes
        for sort_type in sort_types[:4]:  # Top 4 sort types
            params = {
                "zip": zc,
                "inventorySearchWidgetType": "AUTO",
                "distance": 100,
                "sortType": sort_type,
                "maxResults": 100
            }
            listings = fetch_listings(params)
            for l in listings:
                if l.get('id'):
                    all_listings[l['id']] = l
        print(f"  ZIP {zc}: {len(all_listings)} unique")
        time.sleep(0.2)
    
    print(f"\n[2/6] By price ranges...")
    for min_p, max_p in price_ranges[:20]:
        params = {
            "zip": "77479",
            "inventorySearchWidgetType": "AUTO",
            "distance": 200,
            "minPrice": min_p,
            "maxPrice": max_p,
            "maxResults": 100
        }
        listings = fetch_listings(params)
        for l in listings:
            if l.get('id'):
                all_listings[l['id']] = l
        if len(all_listings) % 100 < 50:
            print(f"  Total unique: {len(all_listings)}")
        time.sleep(0.1)
    
    print(f"\n[3/6] By year ranges...")
    for start_year, end_year in year_ranges:
        params = {
            "zip": "77479",
            "inventorySearchWidgetType": "AUTO",
            "distance": 200,
            "startYear": start_year,
            "endYear": end_year,
            "maxResults": 100
        }
        listings = fetch_listings(params)
        for l in listings:
            if l.get('id'):
                all_listings[l['id']] = l
        time.sleep(0.1)
    print(f"  Total unique: {len(all_listings)}")
    
    print(f"\n[4/6] By body type...")
    for body in body_types:
        params = {
            "zip": "77479",
            "inventorySearchWidgetType": "AUTO",
            "distance": 200,
            "bodyTypeGroupId": body,
            "maxResults": 100
        }
        listings = fetch_listings(params)
        for l in listings:
            if l.get('id'):
                all_listings[l['id']] = l
        time.sleep(0.1)
    print(f"  Total unique: {len(all_listings)}")
    
    print(f"\n[5/6] By mileage ranges...")
    for min_m, max_m in mileage_ranges:
        params = {
            "zip": "77479",
            "inventorySearchWidgetType": "AUTO",
            "distance": 200,
            "minMileage": min_m,
            "maxMileage": max_m,
            "maxResults": 100
        }
        listings = fetch_listings(params)
        for l in listings:
            if l.get('id'):
                all_listings[l['id']] = l
        time.sleep(0.1)
    print(f"  Total unique: {len(all_listings)}")
    
    print(f"\n[6/6] Combined filters...")
    # Try combinations
    for zc in zip_codes[:5]:
        for sort in sort_types[:3]:
            for pr in price_ranges[::5][:6]:
                params = {
                    "zip": zc,
                    "inventorySearchWidgetType": "AUTO",
                    "distance": 200,
                    "sortType": sort,
                    "minPrice": pr[0],
                    "maxPrice": pr[1],
                    "maxResults": 100
                }
                listings = fetch_listings(params)
                for l in listings:
                    if l.get('id'):
                        all_listings[l['id']] = l
                time.sleep(0.05)
        if len(all_listings) >= 1000:
            break
    print(f"  Total unique: {len(all_listings)}")
    
    result = list(all_listings.values())
    
    # Save
    with open("cars.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    
    print(f"\n{'=' * 60}")
    print(f"FINAL RESULT: {len(result)} unique car listings saved!")
    print(f"{'=' * 60}")
    
    # Stats
    makes = {}
    for l in result:
        m = l.get("makeName", "Unknown")
        makes[m] = makes.get(m, 0) + 1
    
    print("\nTop 10 Makes:")
    for make, count in sorted(makes.items(), key=lambda x: -x[1])[:10]:
        print(f"  {make}: {count}")
    
    prices = [l.get("price", 0) for l in result if l.get("price", 0) > 0]
    if prices:
        print(f"\nPrice: ${min(prices):,.0f} - ${max(prices):,.0f}")
        print(f"Average: ${sum(prices)/len(prices):,.0f}")


if __name__ == "__main__":
    scrape_comprehensive()
