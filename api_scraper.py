"""
CarGurus API Scraper - Alternative Approach
Tries multiple API endpoints to fetch real car data
"""

import requests
import json
import time

def scrape_via_api(zip_code="77479", max_results=1000):
    """Try to scrape via CarGurus API endpoints."""
    
    print("=" * 60)
    print("CarGurus API Scraper - Alternative Approach")
    print("=" * 60)
    
    # Session with persistent headers
    session = requests.Session()
    
    # Headers that mimic a mobile app request
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
    
    # Try different API endpoints
    endpoints = [
        # Search API
        f"https://www.cargurus.com/Cars/searchResults.action?zip={zip_code}&inventorySearchWidgetType=AUTO&sortDir=ASC&sourceContext=untrackedExternal_false&distance=100&sortType=DEAL_SCORE&offset=0&maxResults=100",
        # Inventory listing API
        f"https://www.cargurus.com/Cars/getFilteredInventoryListing.action?zip={zip_code}&carType=USED&maxResults=100&filtersModified=true",
        # Mobile API endpoint
        f"https://www.cargurus.com/api/v2/listings?zip={zip_code}&condition=USED&limit=100",
    ]
    
    for i, endpoint in enumerate(endpoints):
        print(f"\nTrying endpoint {i+1}/{len(endpoints)}...")
        try:
            response = session.get(endpoint, timeout=30)
            print(f"  Status: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"  Got JSON response with {len(str(data))} chars")
                    
                    # Try to extract listings from various response formats
                    listings = None
                    if isinstance(data, list):
                        listings = data
                    elif isinstance(data, dict):
                        listings = (data.get('listings') or 
                                   data.get('results') or 
                                   data.get('vehicles') or 
                                   data.get('data') or
                                   data.get('inventory'))
                    
                    if listings and len(listings) > 0:
                        print(f"  Found {len(listings)} listings!")
                        all_listings.extend(listings)
                        break
                    else:
                        print("  No listings found in response")
                except json.JSONDecodeError:
                    print("  Response was not JSON")
            elif response.status_code == 403:
                print("  Access forbidden (bot detected)")
            elif response.status_code == 404:
                print("  Endpoint not found")
                
        except requests.RequestException as e:
            print(f"  Request error: {e}")
        
        time.sleep(1)
    
    return all_listings


def try_graphql_api(zip_code="77479"):
    """Try CarGurus GraphQL API endpoint."""
    
    print("\n" + "=" * 60)
    print("Trying GraphQL API...")
    print("=" * 60)
    
    session = requests.Session()
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://www.cargurus.com",
        "Referer": "https://www.cargurus.com/",
    }
    
    # GraphQL query for inventory
    query = {
        "operationName": "SearchInventory",
        "query": """
            query SearchInventory($zip: String!, $limit: Int!) {
                inventory(zip: $zip, limit: $limit) {
                    listings {
                        id
                        title
                        price
                        mileage
                        year
                        make
                        model
                    }
                }
            }
        """,
        "variables": {
            "zip": zip_code,
            "limit": 100
        }
    }
    
    try:
        response = session.post(
            "https://www.cargurus.com/graphql",
            headers=headers,
            json=query,
            timeout=30
        )
        print(f"GraphQL Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if "data" in data and "inventory" in data["data"]:
                return data["data"]["inventory"]["listings"]
    except Exception as e:
        print(f"GraphQL error: {e}")
    
    return []


def main():
    print("\nAttempting to scrape real CarGurus inventory via API...\n")
    
    listings = scrape_via_api(zip_code="77479", max_results=1000)
    
    if not listings:
        listings = try_graphql_api(zip_code="77479")
    
    if listings:
        print(f"\n{'=' * 60}")
        print(f"SUCCESS! Retrieved {len(listings)} real listings")
        print(f"{'=' * 60}")
        
        # Save to JSON
        with open("cars.json", "w", encoding="utf-8") as f:
            json.dump(listings, f, indent=2)
        print(f"Saved to cars.json")
    else:
        print("\n" + "=" * 60)
        print("Could not bypass bot protection via API endpoints.")
        print("CarGurus uses sophisticated bot detection.")
        print("=" * 60)
        print("\nOptions:")
        print("1. Use the sample data (already generated)")
        print("2. Manually solve CAPTCHA when browser opens")
        print("3. Use a paid scraping service (Apify, ScrapingBee, etc.)")


if __name__ == "__main__":
    main()
