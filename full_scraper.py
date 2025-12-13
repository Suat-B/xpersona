"""
CarGurus Full Scraper - Fetches up to 1000 real listings
"""

import requests
import json
import time

def scrape_cargurus_full(zip_code="77479", max_results=1000):
    """Scrape real car listings from CarGurus with pagination."""
    
    print("=" * 60)
    print("CarGurus Full Inventory Scraper")
    print(f"Target: {max_results} listings from ZIP {zip_code}")
    print("=" * 60)
    
    session = requests.Session()
    
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.cargurus.com/",
    }
    session.headers.update(headers)
    
    all_listings = []
    offset = 0
    page_size = 100
    
    while len(all_listings) < max_results:
        print(f"\nFetching listings {offset + 1} to {offset + page_size}...")
        
        endpoint = f"https://www.cargurus.com/Cars/searchResults.action?zip={zip_code}&inventorySearchWidgetType=AUTO&sortDir=ASC&sourceContext=untrackedExternal_false&distance=100&sortType=DEAL_SCORE&offset={offset}&maxResults={page_size}"
        
        try:
            response = session.get(endpoint, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                listings = None
                if isinstance(data, list):
                    listings = data
                elif isinstance(data, dict):
                    listings = (data.get('listings') or 
                               data.get('results') or 
                               data.get('vehicles') or [])
                
                if listings:
                    all_listings.extend(listings)
                    print(f"  Got {len(listings)} listings. Total: {len(all_listings)}")
                    
                    if len(listings) < page_size:
                        print("  No more listings available.")
                        break
                else:
                    print("  No listings in response.")
                    break
            elif response.status_code == 403:
                print("  Access blocked (403). Trying to continue...")
                break
            else:
                print(f"  Error: Status {response.status_code}")
                break
                
        except Exception as e:
            print(f"  Error: {e}")
            break
        
        offset += page_size
        time.sleep(0.5)  # Be respectful
    
    return all_listings[:max_results]


def main():
    print("\nScraping real CarGurus inventory...\n")
    
    listings = scrape_cargurus_full(zip_code="77479", max_results=1000)
    
    if listings:
        # Save to JSON
        with open("cars.json", "w", encoding="utf-8") as f:
            json.dump(listings, f, indent=2)
        
        print(f"\n{'=' * 60}")
        print(f"SUCCESS! Saved {len(listings)} REAL car listings to cars.json")
        print(f"{'=' * 60}")
        
        # Stats
        makes = {}
        for listing in listings:
            make = listing.get("makeName", "Unknown")
            makes[make] = makes.get(make, 0) + 1
        
        print("\nTop Makes:")
        for make, count in sorted(makes.items(), key=lambda x: -x[1])[:10]:
            print(f"  {make}: {count}")
        
        prices = [l.get("price", 0) for l in listings if l.get("price", 0) > 0]
        if prices:
            print(f"\nPrice Range: ${min(prices):,.0f} - ${max(prices):,.0f}")
            print(f"Average Price: ${sum(prices)/len(prices):,.0f}")
    else:
        print("No listings retrieved.")


if __name__ == "__main__":
    main()
