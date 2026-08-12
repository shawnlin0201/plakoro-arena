import { writeFile, mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const SUPABASE_URL = 'https://yyrsscvofuoufkujetgf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cnNzY3ZvZnVvdWZrdWpldGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMzIxMjksImV4cCI6MjA3OTYwODEyOX0.mNPIAGFKhJ65dsSllBprGYk3yZfnJXfYmDcdljW8xA4'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'src', 'data', 'generated')

async function fetchTable(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${table}: HTTP ${res.status} ${await res.text()}`)
  }
  return res.json()
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  console.log('Fetching PLAKORO_CHARA...')
  const chara = await fetchTable('PLAKORO_CHARA')
  console.log(`  -> ${chara.length} rows`)

  console.log('Fetching PLAKORO_WAZA...')
  const waza = await fetchTable('PLAKORO_WAZA')
  console.log(`  -> ${waza.length} rows`)

  await writeFile(join(OUT_DIR, 'chara.json'), JSON.stringify(chara, null, 2) + '\n', 'utf-8')
  await writeFile(join(OUT_DIR, 'waza.json'), JSON.stringify(waza, null, 2) + '\n', 'utf-8')

  console.log(`Wrote ${join(OUT_DIR, 'chara.json')}`)
  console.log(`Wrote ${join(OUT_DIR, 'waza.json')}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
