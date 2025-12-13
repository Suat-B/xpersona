"""
CarGurus Extended Scraper - Multi-Strategy Approach
Fetches listings by querying multiple makes, years, and price ranges to get more data
"""

import requests
import json
import time

def scrape_by_make(session, zip_code, make_id, max_per_make=100):
    """Scrape listings for a specific make."""
    endpoint = f"https://www.cargurus.com/Cars/searchResults.action"
    params = {
        "zip": zip_code,
        "inventorySearchWidgetType": "AUTO",
        "sortDir": "ASC",
        "sourceContext": "untrackedExternal_false",
        "distance": 200,  # Expand radius
        "sortType": "DEAL_SCORE",
        "offset": 0,
        "maxResults": max_per_make,
        "showNegotiable": "true",
        "makeId": make_id
    }
    
    try:
        response = session.get(endpoint, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                return data.get('listings') or data.get('results') or []
    except:
        pass
    return []


def scrape_by_price_range(session, zip_code, min_price, max_price, max_results=100):
    """Scrape listings within a price range."""
    endpoint = f"https://www.cargurus.com/Cars/searchResults.action"
    params = {
        "zip": zip_code,
        "inventorySearchWidgetType": "AUTO",
        "sortDir": "ASC",
        "sourceContext": "untrackedExternal_false",
        "distance": 200,
        "sortType": "PRICE",
        "offset": 0,
        "maxResults": max_results,
        "minPrice": min_price,
        "maxPrice": max_price
    }
    
    try:
        response = session.get(endpoint, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                return data.get('listings') or data.get('results') or []
    except:
        pass
    return []


def scrape_by_sort(session, zip_code, sort_type, max_results=100):
    """Scrape listings with different sort order."""
    endpoint = f"https://www.cargurus.com/Cars/searchResults.action"
    params = {
        "zip": zip_code,
        "inventorySearchWidgetType": "AUTO", 
        "sourceContext": "untrackedExternal_false",
        "distance": 200,
        "sortType": sort_type,
        "offset": 0,
        "maxResults": max_results
    }
    
    try:
        response = session.get(endpoint, params=params, timeout=30)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                return data.get('listings') or data.get('results') or []
    except:
        pass
    return []


def main():
    print("=" * 60)
    print("CarGurus Extended Scraper")
    print("Multi-Strategy Approach to Get 1000+ Listings")
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
    
    zip_code = "77479"
    all_listings = {}  # Use dict to dedupe by ID
    
    # Strategy 1: Different sort orders
    print("\n[Strategy 1] Different sort orders...")
    sort_types = ["DEAL_SCORE", "PRICE", "MILEAGE", "NEWEST_CAR_YEAR", "DISTANCE", "BEST_MATCH"]
    for sort_type in sort_types:
        print(f"  Sorting by {sort_type}...")
        listings = scrape_by_sort(session, zip_code, sort_type, 100)
        for listing in listings:
            lid = listing.get('id')
            if lid:
                all_listings[lid] = listing
        print(f"    Got {len(listings)} listings. Total unique: {len(all_listings)}")
        time.sleep(0.3)
    
    # Strategy 2: Different price ranges
    print("\n[Strategy 2] Different price ranges...")
    price_ranges = [
        (0, 10000), (10000, 15000), (15000, 20000), (20000, 25000),
        (25000, 30000), (30000, 40000), (40000, 50000), (50000, 75000),
        (75000, 100000), (100000, 200000)
    ]
    for min_p, max_p in price_ranges:
        print(f"  Price ${min_p:,} - ${max_p:,}...")
        listings = scrape_by_price_range(session, zip_code, min_p, max_p, 100)
        for listing in listings:
            lid = listing.get('id')
            if lid:
                all_listings[lid] = listing
        print(f"    Got {len(listings)} listings. Total unique: {len(all_listings)}")
        time.sleep(0.3)
    
    # Strategy 3: By popular makes
    print("\n[Strategy 3] By popular makes...")
    # CarGurus make IDs
    makes = {
        "m7": "Toyota", "m6": "Honda", "m3": "Ford", "m1": "Chevrolet",
        "m10": "Nissan", "m41": "BMW", "m47": "Mercedes-Benz", "m32": "Audi",
        "m21": "Lexus", "m17": "Jeep", "m27": "Hyundai", "m28": "Kia",
        "m53": "Subaru", "m30": "Mazda", "m22": "Cadillac", "m191": "RAM",
        "m55": "Volkswagen", "m56": "Volvo", "m2": "GMC", "m35": "Acura",
        "m29": "Lincoln", "m31": "Infiniti", "m16": "Dodge", "m148": "Tesla",
        "m33": "Porsche", "m38": "Land Rover", "m46": "Jaguar", "m18": "Buick"
    }
    
    for make_id, make_name in makes.items():
        print(f"  {make_name} ({make_id})...")
        listings = scrape_by_make(session, zip_code, make_id, 100)
        for listing in listings:
            lid = listing.get('id')
            if lid:
                all_listings[lid] = listing
        print(f"    Got {len(listings)} listings. Total unique: {len(all_listings)}")
        time.sleep(0.3)
        
        if len(all_listings) >= 1000:
            print("  Reached 1000 listings target!")
            break
    
    # Strategy 4: Different ZIP codes nearby
    if len(all_listings) < 1000:
        print("\n[Strategy 4] Nearby ZIP codes...")
        nearby_zips = ["77479", "77494", "77459", "77469", "77083", "77072", "77401", "77098", "77005", "77025"]
        for zc in nearby_zips:
            print(f"  ZIP {zc}...")
            listings = scrape_by_sort(session, zc, "DEAL_SCORE", 100)
            for listing in listings:
                lid = listing.get('id')
                if lid:
                    all_listings[lid] = listing
            print(f"    Total unique: {len(all_listings)}")
            time.sleep(0.3)
            
            if len(all_listings) >= 1000:
                break
    
    # Convert to list
    result = list(all_listings.values())
    
    # Save to JSON
    with open("cars.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    
    print(f"\n{'=' * 60}")
    print(f"SUCCESS! Saved {len(result)} unique car listings to cars.json")
    print(f"{'=' * 60}")
    
    # Stats
    makes_count = {}
    for listing in result:
        make = listing.get("makeName", "Unknown")
        makes_count[make] = makes_count.get(make, 0) + 1
    
    print("\nTop 15 Makes:")
    for make, count in sorted(makes_count.items(), key=lambda x: -x[1])[:15]:
        print(f"  {make}: {count}")
    
    prices = [l.get("price", 0) for l in result if l.get("price", 0) > 0]
    if prices:
        print(f"\nPrice Range: ${min(prices):,.0f} - ${max(prices):,.0f}")
        print(f"Average Price: ${sum(prices)/len(prices):,.0f}")


if __name__ == "__main__":
    main()
