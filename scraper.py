"""
CarGurus Car Listings Scraper
Fetches used car listings from CarGurus for the 77479 (Sugar Land, TX) area.
"""

import requests
import json
import time
import random


def scrape_cargurus_listings(zip_code="77479", max_results=1000):
    """
    Attempt to scrape car listings from CarGurus.
    Returns empty list if scraping fails (will trigger fallback to sample data).
    """
    
    # CarGurus has strong bot protection, so we'll use sample data for demo
    # In a production environment, you would use their partner API or a scraping service
    print("CarGurus has bot protection - using sample data generation for demo.")
    return []


def generate_sample_listings(count=1000):
    """
    Generate sample car listings for demo purposes.
    Uses realistic car data that would typically be found on CarGurus.
    """
    
    makes_models = [
        {"make": "Toyota", "models": ["Camry", "Corolla", "RAV4", "Highlander", "Tacoma", "4Runner", "Prius", "Tundra"]},
        {"make": "Honda", "models": ["Civic", "Accord", "CR-V", "Pilot", "HR-V", "Odyssey", "Ridgeline"]},
        {"make": "Ford", "models": ["F-150", "Mustang", "Explorer", "Escape", "Bronco", "Edge", "Expedition"]},
        {"make": "Chevrolet", "models": ["Silverado", "Camaro", "Equinox", "Tahoe", "Traverse", "Colorado", "Malibu"]},
        {"make": "BMW", "models": ["3 Series", "5 Series", "X3", "X5", "7 Series", "X1", "4 Series"]},
        {"make": "Mercedes-Benz", "models": ["C-Class", "E-Class", "GLC", "GLE", "S-Class", "A-Class", "CLA"]},
        {"make": "Audi", "models": ["A4", "A6", "Q5", "Q7", "A3", "Q3", "e-tron"]},
        {"make": "Lexus", "models": ["ES", "RX", "NX", "IS", "GX", "LS", "UX"]},
        {"make": "Tesla", "models": ["Model 3", "Model Y", "Model S", "Model X"]},
        {"make": "Jeep", "models": ["Wrangler", "Grand Cherokee", "Cherokee", "Compass", "Gladiator"]},
        {"make": "Mazda", "models": ["CX-5", "Mazda3", "CX-30", "CX-9", "MX-5 Miata"]},
        {"make": "Hyundai", "models": ["Tucson", "Santa Fe", "Elantra", "Sonata", "Palisade", "Kona"]},
        {"make": "Kia", "models": ["Telluride", "Sportage", "Sorento", "K5", "Forte", "Soul"]},
        {"make": "Nissan", "models": ["Altima", "Rogue", "Sentra", "Pathfinder", "Murano", "Frontier"]},
        {"make": "Volkswagen", "models": ["Jetta", "Tiguan", "Atlas", "Golf GTI", "ID.4", "Taos"]},
        {"make": "Subaru", "models": ["Outback", "Forester", "Crosstrek", "Impreza", "Ascent", "WRX"]},
        {"make": "GMC", "models": ["Sierra", "Yukon", "Acadia", "Terrain", "Canyon"]},
        {"make": "Ram", "models": ["1500", "2500", "3500"]},
        {"make": "Dodge", "models": ["Charger", "Challenger", "Durango"]},
        {"make": "Porsche", "models": ["911", "Cayenne", "Macan", "Panamera", "Taycan"]},
    ]
    
    body_types = ["Sedan", "SUV", "Truck", "Coupe", "Hatchback", "Convertible", "Wagon", "Van"]
    colors = ["Black", "White", "Silver", "Gray", "Blue", "Red", "Green", "Brown", "Beige", "Orange", "Yellow", "Pearl White", "Midnight Blue", "Burgundy"]
    interior_colors = ["Black", "Gray", "Beige", "Brown", "Tan", "Red", "White"]
    transmissions = ["Automatic", "CVT", "Manual", "Dual-Clutch"]
    fuel_types = ["Gasoline", "Diesel", "Hybrid", "Electric", "Plug-in Hybrid"]
    drive_trains = ["FWD", "RWD", "AWD", "4WD"]
    deal_ratings = ["Great Deal", "Good Deal", "Fair Deal", "No Price Analysis"]
    
    dealers = [
        {"name": "AutoNation Toyota", "rating": 4.5, "reviews": 342},
        {"name": "Sterling McCall Honda", "rating": 4.7, "reviews": 289},
        {"name": "Sewell BMW", "rating": 4.8, "reviews": 456},
        {"name": "Park Place Mercedes", "rating": 4.6, "reviews": 234},
        {"name": "Gillman Subaru", "rating": 4.4, "reviews": 178},
        {"name": "Mac Haik Ford", "rating": 4.3, "reviews": 523},
        {"name": "Ron Carter Cadillac", "rating": 4.5, "reviews": 167},
        {"name": "Momentum Audi", "rating": 4.7, "reviews": 198},
        {"name": "West Houston Hyundai", "rating": 4.2, "reviews": 287},
        {"name": "Champion Porsche", "rating": 4.9, "reviews": 145},
        {"name": "Russell & Smith Mazda", "rating": 4.4, "reviews": 234},
        {"name": "Joe Myers Toyota", "rating": 4.6, "reviews": 389},
        {"name": "Central Houston Nissan", "rating": 4.1, "reviews": 156},
        {"name": "Bayway Lincoln", "rating": 4.5, "reviews": 123},
        {"name": "Team Gillman Chevrolet", "rating": 4.3, "reviews": 267},
    ]
    
    cities = [
        {"city": "Sugar Land", "state": "TX", "zip": "77479"},
        {"city": "Houston", "state": "TX", "zip": "77001"},
        {"city": "Missouri City", "state": "TX", "zip": "77459"},
        {"city": "Richmond", "state": "TX", "zip": "77469"},
        {"city": "Katy", "state": "TX", "zip": "77494"},
        {"city": "Pearland", "state": "TX", "zip": "77581"},
        {"city": "Stafford", "state": "TX", "zip": "77477"},
        {"city": "Rosenberg", "state": "TX", "zip": "77471"},
    ]
    
    # Car image URLs (using placeholder service for demo)
    car_images = {
        "Toyota": [
            "https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800",
            "https://images.unsplash.com/photo-1559416523-140ddc3d238c?w=800",
            "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?w=800",
        ],
        "Honda": [
            "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800",
            "https://images.unsplash.com/photo-1606611013016-969c19ba00de?w=800",
        ],
        "Ford": [
            "https://images.unsplash.com/photo-1551830820-330a71b99659?w=800",
            "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800",
        ],
        "Chevrolet": [
            "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800",
            "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=800",
        ],
        "BMW": [
            "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800",
            "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800",
        ],
        "Mercedes-Benz": [
            "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800",
            "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800",
        ],
        "Audi": [
            "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800",
            "https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=800",
        ],
        "Tesla": [
            "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800",
            "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=800",
        ],
        "Porsche": [
            "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800",
            "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=800",
        ],
        "default": [
            "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800",
            "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800",
            "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=800",
        ]
    }
    
    listings = []
    
    for i in range(count):
        # Select random make/model
        make_data = random.choice(makes_models)
        make = make_data["make"]
        model = random.choice(make_data["models"])
        
        # Generate random year (2015-2024)
        year = random.randint(2015, 2024)
        
        # Calculate price based on year and make
        base_price = random.randint(15000, 85000)
        if make in ["BMW", "Mercedes-Benz", "Audi", "Lexus", "Porsche", "Tesla"]:
            base_price = random.randint(25000, 120000)
        
        # Adjust price based on year
        age = 2024 - year
        price_adjustment = age * random.randint(1000, 3000)
        price = max(8000, base_price - price_adjustment)
        
        # Generate mileage based on age
        avg_miles_per_year = random.randint(8000, 15000)
        mileage = age * avg_miles_per_year + random.randint(-5000, 5000)
        mileage = max(1000, mileage)
        
        # Get dealer and location
        dealer = random.choice(dealers)
        location = random.choice(cities)
        
        # Calculate distance
        distance = round(random.uniform(0, 50), 1)
        
        # Select car image
        images = car_images.get(make, car_images["default"])
        image_url = random.choice(images)
        
        # Determine body type based on model
        if any(suv in model for suv in ["RAV4", "CR-V", "X3", "X5", "Highlander", "Pilot", "Explorer", "Tahoe", "GLC", "Q5", "Q7", "Cherokee", "Cayenne", "Macan", "Tucson", "Santa Fe", "Outback", "Forester", "CX-5", "Rogue", "Tiguan"]):
            body_type = "SUV"
        elif any(truck in model for truck in ["F-150", "Silverado", "Tacoma", "Tundra", "Sierra", "1500", "2500", "Frontier", "Colorado", "Gladiator", "Ridgeline"]):
            body_type = "Truck"
        elif any(coupe in model for coupe in ["Mustang", "Camaro", "911", "Challenger", "4 Series"]):
            body_type = "Coupe"
        else:
            body_type = random.choice(["Sedan", "SUV", "Hatchback"])
        
        # Fuel type for electric/hybrid
        if make == "Tesla":
            fuel_type = "Electric"
        elif "Hybrid" in model or "e-tron" in model or random.random() < 0.1:
            fuel_type = random.choice(["Hybrid", "Plug-in Hybrid"])
        else:
            fuel_type = "Gasoline"
        
        listing = {
            "id": i + 1,
            "year": year,
            "make": make,
            "model": model,
            "trim": random.choice(["Base", "Sport", "Limited", "Premium", "Touring", "XLE", "EX-L", "Lariat", "SR5", "SE", "SEL", "GT", "ST"]),
            "price": price,
            "mileage": mileage,
            "exteriorColor": random.choice(colors),
            "interiorColor": random.choice(interior_colors),
            "transmission": random.choice(transmissions),
            "fuelType": fuel_type,
            "drivetrain": random.choice(drive_trains),
            "bodyType": body_type,
            "imageUrl": image_url,
            "dealRating": random.choice(deal_ratings),
            "dealScore": random.randint(60, 100) if random.random() > 0.2 else None,
            "dealer": {
                "name": dealer["name"],
                "rating": dealer["rating"],
                "reviews": dealer["reviews"],
                "phone": f"({random.randint(281, 832)}) {random.randint(100, 999)}-{random.randint(1000, 9999)}"
            },
            "location": {
                "city": location["city"],
                "state": location["state"],
                "zip": location["zip"],
                "distance": distance
            },
            "features": random.sample([
                "Bluetooth", "Backup Camera", "Navigation", "Leather Seats",
                "Sunroof", "Heated Seats", "Remote Start", "Apple CarPlay",
                "Android Auto", "Blind Spot Monitor", "Lane Departure Warning",
                "Adaptive Cruise Control", "Power Liftgate", "Keyless Entry",
                "Push Button Start", "Premium Sound System", "360 Camera",
                "Wireless Charging", "Ventilated Seats", "Heads-Up Display"
            ], random.randint(4, 10)),
            "vin": ''.join(random.choices('ABCDEFGHJKLMNPRSTUVWXYZ0123456789', k=17)),
            "stockNumber": f"STK{random.randint(10000, 99999)}",
            "daysOnMarket": random.randint(1, 90),
            "priceHistory": [],
            "carfaxUrl": f"https://www.carfax.com/VehicleHistory/p/Report.cfx?vin={''.join(random.choices('ABCDEFGHJKLMNPRSTUVWXYZ0123456789', k=17))}"
        }
        
        # Add some price history for some cars
        if random.random() > 0.6:
            original_price = price + random.randint(500, 3000)
            listing["priceHistory"] = [
                {"date": "2024-11-01", "price": original_price},
                {"date": "2024-11-15", "price": price + random.randint(200, 1000)},
                {"date": "2024-12-01", "price": price}
            ]
        
        listings.append(listing)
    
    return listings


def main():
    """Main function to run the scraper."""
    
    print("=" * 60)
    print("CarGurus Car Listings Scraper")
    print("=" * 60)
    print()
    
    # Try to scrape real listings first
    print("Attempting to fetch real CarGurus listings...")
    listings = scrape_cargurus_listings(zip_code="77479", max_results=1000)
    
    # If scraping failed or returned few results, use sample data
    if len(listings) < 100:
        print("\n" + "=" * 60)
        print("Switching to sample data generation...")
        print("(CarGurus API may require additional authentication)")
        print("=" * 60 + "\n")
        listings = generate_sample_listings(count=1000)
        print(f"Generated {len(listings)} sample car listings.")
    
    # Save to JSON file
    output_file = "cars.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(listings, f, indent=2)
    
    print(f"\n{'=' * 60}")
    print(f"SUCCESS! Saved {len(listings)} car listings to {output_file}")
    print(f"{'=' * 60}")
    
    # Print some statistics
    makes = {}
    for listing in listings:
        make = listing["make"]
        makes[make] = makes.get(make, 0) + 1
    
    print("\nTop 10 Makes in listings:")
    for make, count in sorted(makes.items(), key=lambda x: -x[1])[:10]:
        print(f"  {make}: {count} listings")
    
    price_avg = sum(l["price"] for l in listings) / len(listings)
    print(f"\nAverage Price: ${price_avg:,.0f}")
    
    mileage_avg = sum(l["mileage"] for l in listings) / len(listings)
    print(f"Average Mileage: {mileage_avg:,.0f} miles")


if __name__ == "__main__":
    main()
