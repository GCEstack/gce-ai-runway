import cloudscraper
import re, json
from datetime import datetime, timedelta

scraper = cloudscraper.create_scraper()
url = 'https://www.beatport.com/genre/melodic-house-techno/90/top-100-releases'
res = scraper.get(url, timeout=30)
html = res.text
m = re.search(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.S)
data = json.loads(m.group(1))
queries = data['props']['pageProps']['dehydratedState']['queries']
for q in queries:
    if 'results' in q['state']['data']:
        tracks = q['state']['data']['results']
        print('found', len(tracks), 'tracks')
        cutoff = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        recent = [t for t in tracks if (t.get('new_release_date') or t.get('publish_date') or '') >= cutoff]
        print('recent (7d)', len(recent))
        for t in recent[:3]:
            print('---')
            print('name', t.get('name'))
            print('artists', [a.get('name') for a in t.get('artists', [])])
            print('publish_date', t.get('publish_date'))
            print('new_release_date', t.get('new_release_date'))
        break
