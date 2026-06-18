import cloudscraper, re
from bs4 import BeautifulSoup
scraper = cloudscraper.create_scraper()
res = scraper.get('https://1001tracklists.com/', timeout=30)
soup = BeautifulSoup(res.text, 'html.parser')
ALLOWED = {"techno", "melodic techno", "melodic house/techno"}
for item_div in soup.find_all('div', class_='bItm')[:10]:
    a = item_div.find('a', href=re.compile(r'/tracklist/'))
    if not a: continue
    full = item_div.get_text(strip=True, separator=' | ')
    parts = [p.strip() for p in full.split('|')]
    genres_text = parts[-1] if parts else ''
    genres = {g.strip().lower() for g in genres_text.split(',') if g.strip()}
    matched = {g for g in genres if any(allowed in g for allowed in ALLOWED)}
    print('genres', genres)
    print('matched', matched)
    print('full', full[:200])
    print('---')
