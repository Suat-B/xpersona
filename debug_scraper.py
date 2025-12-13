import requests
import json

def test_endpoint(name, url, params):
    print(f"\nTesting {name}...")
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "X-Requested-With": "XMLHttpRequest"
    })
    
    try:
        r = session.get(url, params=params, timeout=10)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list):
                print(f"Result: List with {len(data)} items")
                if len(data) > 0:
                    print(f"Sample ID: {data[0].get('id')}")
            elif isinstance(data, dict):
                listings = data.get('listings') or data.get('results') or []
                print(f"Result: Dict with {len(listings)} listings")
                if len(listings) > 0:
                    print(f"Sample ID: {listings[0].get('id')}")
            else:
                print("Result: Unknown format")
        else:
            print(f"Error: {r.text[:200]}")
    except Exception as e:
        print(f"Exception: {e}")

# Test params for a common car
params = {
    "zip": "77479",
    "distance": 500,
    "makeId": "m7", # Toyota
    "startYear": 2020,
    "endYear": 2020,
    "maxResults": 100
}

# 1. searchResults.action
test_endpoint(
    "searchResults.action", 
    "https://www.cargurus.com/Cars/searchResults.action",
    {**params, "inventorySearchWidgetType": "AUTO"}
)

# 2. getFilteredInventoryListing.action
test_endpoint(
    "getFilteredInventoryListing.action", 
    "https://www.cargurus.com/Cars/getFilteredInventoryListing.action",
    params
)
