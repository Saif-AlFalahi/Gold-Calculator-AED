import requests

TROY_OUNCE_TO_GRAMS = 31.1035
USD_TO_AED = 3.6725
GRAMS = 20

def get_gold_value():
    try:
        url = "https://query1.finance.yahoo.com/v8/finance/chart/GC=F"

        headers = {
            "User-Agent": "Mozilla/5.0"
        }

        response = requests.get(url, headers=headers)

        # Print raw response if request failed
        if response.status_code != 200:
            print("HTTP Error:", response.status_code)
            print(response.text)
            return
        
        data = response.json()

        # Current gold futures price in USD per troy ounce
        gcf_price = data["chart"]["result"][0]["meta"]["regularMarketPrice"]

        # Convert to AED per gram
        aed_per_gram = (gcf_price / TROY_OUNCE_TO_GRAMS) * USD_TO_AED

        # Total value for fixed 20g
        total_aed = aed_per_gram * GRAMS

        print(f"GC=F Price: ${gcf_price}")
        print(f"Selling value today: {total_aed:.2f} AED")

    except Exception as e:
        print("Error:", e)

    input("\nPress Enter to exit...")
    
if __name__ == "__main__":
    get_gold_value()
