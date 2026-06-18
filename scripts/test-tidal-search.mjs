const token = process.argv[2]
if (!token) {
  console.error('Usage: node test-tidal-search.mjs <token>')
  process.exit(1)
}

const queries = ['ACID RAW', 'acid raw techno', 'leftfield acidic raw textures', 'acid techno', 'techno']

for (const q of queries) {
  try {
    const r = await fetch('https://openapi.tidal.com/v2/search?query=' + encodeURIComponent(q) + '&countryCode=US&include=tracks&limit=5', {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.api+json' }
    })
    const text = await r.text()
    if (!r.ok) {
      console.log(q, '=> ERROR', r.status, text.slice(0, 200))
      continue
    }
    const d = JSON.parse(text)
    const tracks = (d.included || []).filter(i => i.type === 'tracks')
    console.log(q, '=>', tracks.length, 'tracks')
    if (tracks.length) {
      console.log('  first:', tracks[0].attributes?.title, '-', tracks[0].attributes?.artist?.name)
    }
  } catch (e) {
    console.log(q, '=> EXCEPTION', e.message)
  }
}
