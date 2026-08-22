// 나이스 학사일정 CSV(전국) → public/schools/ 검색 데이터 생성
//   node scripts/build-schools.mjs "<학사일정_2026_3.csv>" ["<...4월.csv>" ...]
//
// 원본은 교육부 나이스/공공데이터포털의 "전국 학교 학사일정" 내려받기 파일이다.
// 열: 시도교육청코드, 시도교육청명, 행정표준코드, 학교명, 학년도, 주야과정명, 학교과정명,
//     수업공제일명, 학사일자, 행사명, 행사내용, 1~6학년행사여부, 수정일자
//
// 파일을 여러 번 나눠 받았어도(월별 등) 한 번에 넘기면 합쳐진다. 이미 만들어 둔
// public/schools/ 가 있으면 그것도 같이 합치므로, 새 달치만 넘겨도 누적된다.
// 같은 (학교·과정·날짜·행사명)은 한 건으로 묶고 학년 표시만 합친다.
//
// 주말 행사(토요휴업일 등)는 담지 않는다 — 진도 계산은 평일만 보기 때문에 쓸모가 없고,
// 이것만 걷어내도 원본의 절반이 줄어든다. 필요하면 --with-weekend 로 남길 수 있다.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'schools')
const LEVELS = ['유치원', '초등학교', '중학교', '고등학교', '전공과', '기타']

const args = process.argv.slice(2)
const keepWeekend = args.includes('--with-weekend')
const inputs = args.filter(a => !a.startsWith('--'))
if (!inputs.length) {
  console.error('사용법: node scripts/build-schools.mjs "<학사일정.csv>" [...]  [--with-weekend]')
  process.exit(1)
}

// ── CSV ──────────────────────────────────────────────────────────────────────
// 원본은 EUC-KR(CP949)로 내려오지만 UTF-8로 저장해 둔 것도 그대로 읽는다.
function decode(buf) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return new TextDecoder('utf-8').decode(buf.subarray(3))
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf)
  if (!utf8.includes('�')) return utf8
  return new TextDecoder('euc-kr').decode(buf)
}

// 따옴표 안의 쉼표·줄바꿈을 지키는 최소 파서
function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
      continue
    }
    if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

// ── 분류 ─────────────────────────────────────────────────────────────────────
// 앱의 일정 유형(휴업일·행사·고사)으로 옮긴다. 지필평가처럼 이름이 분명한 것만 고사로 보고,
// 모의고사·학력평가는 수업을 하는 날이 많아 행사로 둔다 (앱에서 유형을 눌러 바꿀 수 있다).
const EXAM = /지필|중간고사|기말고사|정기고사|학기말고사|기말시험|중간시험/
const TYPE = { 행사: 0, 휴업일: 1, 고사: 2 }
function typeOf(row) {
  if (row.공제 === '휴업일' || row.공제 === '공휴일') return TYPE.휴업일
  if (EXAM.test(row.행사명)) return TYPE.고사
  return TYPE.행사
}

const DOW = iso => new Date(iso + 'T00:00:00').getDay()
const toISO = s => s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8)

// ── 누적 ─────────────────────────────────────────────────────────────────────
// regions[코드] = {name, schools: Map<키, {code,name,level}>, events: Map<키, Map<날짜|이름, ev>>}
const regions = new Map()
const meta = { years: new Set(), dates: [] }

function region(code, name) {
  if (!regions.has(code)) regions.set(code, { code, name, schools: new Map(), events: new Map() })
  const r = regions.get(code)
  if (name) r.name = name
  return r
}

// 이미 만들어 둔 결과를 먼저 읽어 들인다 — 새 달치 CSV만 넘겨도 쌓인다.
function loadExisting() {
  const idxPath = join(OUT_DIR, 'index.json')
  if (!existsSync(idxPath)) return
  const idx = JSON.parse(readFileSync(idxPath, 'utf-8'))
  for (const y of idx.years || []) meta.years.add(y)
  for (const [code, info] of Object.entries(idx.regions || {})) {
    const r = region(code, info.name)
    for (const [schoolCode, name, level] of info.schools) r.schools.set(schoolCode + '-' + level, { code: schoolCode, name, level })
    const file = join(OUT_DIR, code + '.json')
    if (!existsSync(file)) continue
    for (const [key, evs] of Object.entries(JSON.parse(readFileSync(file, 'utf-8')))) {
      const m = new Map()
      for (const ev of evs) {
        m.set(ev[0] + '|' + ev[1], ev)
        meta.dates.push(ev[0])
      }
      r.events.set(key, m)
    }
  }
}

let read = 0
let skippedWeekend = 0
function ingest(path) {
  const rows = parseCSV(decode(readFileSync(path)))
  const head = rows.shift()
  const col = Object.fromEntries(head.map((h, i) => [h.trim(), i]))
  const need = ['시도교육청코드', '행정표준코드', '학교명', '학교과정명', '학사일자', '행사명']
  const missing = need.filter(k => col[k] === undefined)
  if (missing.length) throw new Error(path + ': 나이스 학사일정 CSV가 아닙니다 (없는 열: ' + missing.join(', ') + ')')

  for (const raw of rows) {
    if (raw.length < head.length - 2) continue
    const get = k => (col[k] === undefined ? '' : (raw[col[k]] || '').trim())
    const date = get('학사일자')
    const name = get('행사명')
    if (!/^\d{8}$/.test(date) || !name) continue
    const iso = toISO(date)
    read++

    const lvIdx = Math.max(0, LEVELS.indexOf(get('학교과정명') || '기타'))
    const r = region(get('시도교육청코드'), get('시도교육청명'))
    const schoolCode = get('행정표준코드')
    const key = schoolCode + '-' + lvIdx
    // 학교는 주말 행사밖에 없어도 목록에 넣는다 — 검색해서 "일정이 없다"까지 알 수 있게.
    if (!r.schools.has(key)) r.schools.set(key, { code: schoolCode, name: get('학교명'), level: lvIdx })
    if (!keepWeekend && (DOW(iso) === 0 || DOW(iso) === 6)) { skippedWeekend++; continue }

    // 학년 표시: 1~6학년 비트. Y 인 학년만 켠다 ('*'는 그 학교에 없는 학년)
    let grades = 0
    for (let g = 1; g <= 6; g++) if (get(g + '학년행사여부') === 'Y') grades |= 1 << (g - 1)

    const type = typeOf({ 공제: get('수업공제일명'), 행사명: name })
    const detail = get('행사내용')
    const evKey = iso + '|' + name
    if (!r.events.has(key)) r.events.set(key, new Map())
    const bucket = r.events.get(key)
    const prev = bucket.get(evKey)
    if (prev) {
      prev[2] = Math.max(prev[2], type) // 휴업일·고사가 행사보다 정보량이 많다
      prev[3] |= grades
      if (detail && !prev[4]) prev[4] = detail
    } else {
      const ev = [iso, name, type, grades]
      if (detail) ev.push(detail)
      bucket.set(evKey, ev)
    }
    meta.years.add(Number(get('학년도')) || Number(iso.slice(0, 4)))
    meta.dates.push(iso)
  }
}

loadExisting()
for (const path of inputs) ingest(path)

// ── 출력 ─────────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true })
for (const f of readdirSync(OUT_DIR)) if (f.endsWith('.json')) writeFileSync(join(OUT_DIR, f), '') // 지워질 지역이 남지 않게 비워 두고 다시 쓴다

const index = {
  builtAt: new Date().toISOString().slice(0, 10),
  years: [...meta.years].sort(),
  start: meta.dates.length ? meta.dates.reduce((a, b) => (a < b ? a : b)) : '',
  end: meta.dates.length ? meta.dates.reduce((a, b) => (a > b ? a : b)) : '',
  levels: LEVELS,
  regions: {},
}

let events = 0
let schools = 0
for (const r of [...regions.values()].sort((a, b) => a.code.localeCompare(b.code))) {
  const list = [...r.schools.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  index.regions[r.code] = { name: r.name, schools: list.map(s => [s.code, s.name, s.level]) }
  schools += list.length

  const out = {}
  for (const s of list) {
    const bucket = r.events.get(s.code + '-' + s.level)
    if (!bucket || !bucket.size) continue
    const evs = [...bucket.values()].sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1], 'ko') : a[0] < b[0] ? -1 : 1))
    out[s.code + '-' + s.level] = evs
    events += evs.length
  }
  writeFileSync(join(OUT_DIR, r.code + '.json'), JSON.stringify(out))
}
writeFileSync(join(OUT_DIR, 'index.json'), JSON.stringify(index))

// 빈 파일로 남은 것은 정리
for (const f of readdirSync(OUT_DIR)) {
  const p = join(OUT_DIR, f)
  if (f.endsWith('.json') && readFileSync(p, 'utf-8') === '') writeFileSync(p, '{}')
}

const kb = n => (n / 1024).toFixed(0) + 'KB'
const total = readdirSync(OUT_DIR).reduce((a, f) => a + readFileSync(join(OUT_DIR, f)).length, 0)
console.log(
  '읽은 행 ' + read.toLocaleString() +
  ' · 주말 제외 ' + skippedWeekend.toLocaleString() +
  '\n교육청 ' + regions.size + ' · 학교 ' + schools.toLocaleString() + ' · 일정 ' + events.toLocaleString() +
  '\n기간 ' + index.start + ' ~ ' + index.end +
  '\n출력 public/schools/ ' + (regions.size + 1) + '개 파일 ' + kb(total)
)
