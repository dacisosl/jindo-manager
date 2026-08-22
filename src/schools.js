// 전국 학사일정 검색 — public/schools/ 에 미리 만들어 둔 데이터를 읽는다.
// (원본: 나이스 학사일정 CSV → scripts/build-schools.mjs)
//
// 목록(index.json)은 처음 검색할 때 한 번, 일정은 고른 학교의 교육청 파일만 받는다.
// 둘 다 한 번 받으면 이 탭에서는 다시 받지 않는다.
const BASE = () => import.meta.env.BASE_URL + 'schools/'

export const EVENT_TYPES = ['행사', '휴업일', '고사'] // 저장된 숫자 → 앱의 일정 유형

let indexPromise = null
const regionCache = new Map()

async function getJSON(file) {
  const res = await fetch(BASE() + file, { cache: 'force-cache' })
  if (!res.ok) throw new Error('NOFILE')
  return res.json()
}

// {meta:{start,end,years,levels}, schools:[{key,code,name,level,levelName,region,regionName}]}
export function loadSchoolIndex() {
  if (!indexPromise) {
    indexPromise = getJSON('index.json')
      .then(idx => {
        const levels = idx.levels || []
        const schools = []
        for (const [region, info] of Object.entries(idx.regions || {})) {
          for (const [code, name, level] of info.schools) {
            schools.push({
              key: code + '-' + level,
              code,
              name,
              level,
              levelName: levels[level] || '',
              region,
              regionName: info.name,
              search: name.replace(/\s+/g, ''),
              chosung: chosung(name),
            })
          }
        }
        return { meta: { start: idx.start, end: idx.end, years: idx.years || [], levels, builtAt: idx.builtAt }, schools }
      })
      .catch(e => {
        indexPromise = null // 실패는 기억하지 않는다 — 다시 시도할 수 있게
        throw e
      })
  }
  return indexPromise
}

export function loadSchoolEvents(region, key) {
  if (!regionCache.has(region)) {
    regionCache.set(
      region,
      getJSON(region + '.json').catch(e => {
        regionCache.delete(region)
        throw e
      })
    )
  }
  return regionCache.get(region).then(map => (map[key] || []).map(([date, name, type, grades, detail]) => ({
    date, name, type, grades, detail: detail || '',
  })))
}

// 한글 초성 — "ㄱㄹㄱ"으로도 가락고를 찾을 수 있게
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
function chosung(s) {
  let out = ''
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    if (c >= 0xac00 && c <= 0xd7a3) out += CHO[Math.floor((c - 0xac00) / 588)]
    else if (!/\s/.test(ch)) out += ch
  }
  return out
}
const isChosungQuery = q => q.length > 1 && [...q].every(ch => CHO.includes(ch))

// 이름 검색. 앞에서부터 맞는 학교를 위로 올리고, 학교급 필터를 걸 수 있다.
export function searchSchools(schools, query, { level = null, limit = 60 } = {}) {
  const q = query.trim().replace(/\s+/g, '')
  if (!q) return []
  const cho = isChosungQuery(q)
  const hits = []
  for (const s of schools) {
    if (level != null && s.level !== level) continue
    const hay = cho ? s.chosung : s.search
    const i = hay.indexOf(q)
    if (i < 0) continue
    hits.push({ s, rank: (i === 0 ? 0 : 1) * 100 + i })
    if (hits.length > 4000) break // 한 글자 검색처럼 너무 넓은 질의는 적당히 끊는다
  }
  hits.sort((a, b) => a.rank - b.rank || a.s.name.localeCompare(b.s.name, 'ko'))
  return hits.slice(0, limit).map(h => h.s)
}

// 고른 일정들을 앱의 events 로 바꾼다.
// 이름·유형이 같은 연속된 날은 한 건(기간)으로 묶는다 — 고사 3일이 세 줄로 들어가지 않도록.
export function toAppEvents(picked, baseId = Date.now()) {
  const groups = new Map()
  for (const ev of picked) {
    const k = ev.name + '|' + ev.type
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(ev.date)
  }
  const out = []
  for (const [k, dates] of groups) {
    const [name, type] = [k.slice(0, k.lastIndexOf('|')), Number(k.slice(k.lastIndexOf('|') + 1))]
    for (const r of mergeRuns(dates)) {
      out.push({ id: baseId + out.length, start: r.start, end: r.end, name, type: EVENT_TYPES[type] || '행사' })
    }
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
}

// 이어지는 날짜 묶기. 주말은 건너뛰어도 이어진 것으로 본다 (금–월 고사).
function mergeRuns(dates) {
  const sorted = [...new Set(dates)].sort()
  const out = []
  for (const iso of sorted) {
    const last = out[out.length - 1]
    if (last && nextSchoolDay(last.end) === iso) last.end = iso
    else out.push({ start: iso, end: iso })
  }
  return out
}

function nextSchoolDay(iso) {
  const d = new Date(iso + 'T00:00:00')
  do d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6)
  const p = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}
