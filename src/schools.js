// 전국 학사일정 검색.
//
// 나이스 오픈API(open.neis.go.kr)를 브라우저에서 직접 호출해 학교와 학사일정을
// 실시간으로 받는다 — 학년도 전체가 조회되고 데이터를 따로 갱신할 것이 없다.
// 나이스가 응답하지 않으면(점검·차단 등) public/schools/ 에 미리 만들어 둔
// 내장 데이터로 자동 전환한다 (원본: 나이스 학사일정 CSV → scripts/build-schools.mjs).
const BASE = () => import.meta.env.BASE_URL + 'schools/'

export const EVENT_TYPES = ['행사', '휴업일', '고사'] // 저장된 숫자 → 앱의 일정 유형

// 지필평가처럼 이름이 분명한 것만 고사로 본다. 모의고사·학력평가는 수업을 하는
// 날이 많아 행사로 둔다 (내장 데이터를 만드는 build-schools.mjs 와 같은 기준).
const EXAM = /지필|중간고사|기말고사|정기고사|학기말고사|기말시험|중간시험/

// ── 나이스 오픈API ───────────────────────────────────────────────────────────
// 공공데이터 인증키. 학사일정은 공개 데이터라 키가 드러나도 조회량 제한 밖의
// 위험은 없다. 키를 바꾸려면 이 값만 고치면 된다.
export const NEIS_KEY = '03e6af66fa5c46a0a4870c89e63dddba'
const NEIS_BASE = 'https://open.neis.go.kr/hub/'

async function neis(path, params) {
  const qs = new URLSearchParams({ KEY: NEIS_KEY, Type: 'json', ...params })
  const res = await fetch(NEIS_BASE + path + '?' + qs)
  if (!res.ok) throw new Error('나이스 응답 오류 (' + res.status + ')')
  const json = await res.json()
  const block = json && json[path]
  if (!block) {
    // 결과가 없으면 {RESULT:{CODE:'INFO-200'}} 만 온다 — 오류가 아니라 빈 결과다
    const code = (json && json.RESULT && json.RESULT.CODE) || ''
    if (code.startsWith('INFO-200')) return []
    throw new Error((json && json.RESULT && json.RESULT.MESSAGE) || '나이스 응답 오류')
  }
  const rows = block.find(b => Array.isArray(b.row))
  return rows ? rows.row : []
}

// 나이스 학교급 이름 → 내장 데이터와 같은 번호 (초1 · 중2 · 고3, 그 밖은 기타)
const NEIS_LEVEL = { 초등학교: 1, 중학교: 2, 고등학교: 3 }

export async function neisSearchSchools(query, { limit = 60 } = {}) {
  const q = query.trim()
  if (!q) return []
  const rows = await neis('schoolInfo', { pIndex: 1, pSize: 100, SCHUL_NM: q })
  const norm = q.replace(/\s+/g, '')
  const list = rows.map(r => {
    const levelName = r.SCHUL_KND_SC_NM || ''
    const level = NEIS_LEVEL[levelName] != null ? NEIS_LEVEL[levelName] : 5
    return {
      key: r.SD_SCHUL_CODE + '-' + level,
      code: r.SD_SCHUL_CODE,
      name: r.SCHUL_NM,
      level,
      levelName,
      region: r.ATPT_OFCDC_SC_CODE,
      regionName: r.ATPT_OFCDC_SC_NM || '',
      src: 'neis',
    }
  })
  // 이름이 질의로 시작하는 학교를 위로
  const pos = s => s.name.replace(/\s+/g, '').indexOf(norm)
  list.sort((a, b) => {
    const ai = pos(a)
    const bi = pos(b)
    return (ai < 0) - (bi < 0) || ai - bi || a.name.localeCompare(b.name, 'ko')
  })
  return list.slice(0, limit)
}

// 학사일정을 나이스에서 받아 내장 데이터와 같은 모양({date,name,type,grades,detail})으로 준다.
// 주말 행사는 평일 차시 계산에 쓰이지 않아 걸러낸다. 주야·중복 행은 학년 표시만 합쳐 한 건으로.
export async function neisSchedule(school, fromIso, toIso) {
  const ymd = s => s.replace(/-/g, '')
  const all = []
  for (let pIndex = 1; pIndex <= 5; pIndex++) {
    const rows = await neis('SchoolSchedule', {
      pIndex,
      pSize: 1000,
      ATPT_OFCDC_SC_CODE: school.region,
      SD_SCHUL_CODE: school.code,
      AA_FROM_YMD: ymd(fromIso),
      AA_TO_YMD: ymd(toIso),
    })
    all.push(...rows)
    if (rows.length < 1000) break
  }

  // 병설유치원 등 다른 과정의 일정이 섞여 오면 이 학교급 것만 남긴다
  const mine = all.filter(r => r.SCHUL_CRSE_SC_NM === school.levelName)
  const rows = mine.length ? mine : all

  const merged = new Map()
  for (const r of rows) {
    const date = String(r.AA_YMD || '')
    const name = (r.EVENT_NM || '').trim()
    if (!/^\d{8}$/.test(date) || !name) continue
    const iso = date.slice(0, 4) + '-' + date.slice(4, 6) + '-' + date.slice(6, 8)
    const dow = new Date(iso + 'T00:00:00').getDay()
    if (dow === 0 || dow === 6) continue

    const sbtr = r.SBTR_DD_SC_NM || ''
    const type = sbtr === '휴업일' || sbtr === '공휴일' ? 1 : EXAM.test(name) ? 2 : 0
    let grades = 0
    const flags = [r.ONE_GRADE_EVENT_YN, r.TW_GRADE_EVENT_YN, r.THREE_GRADE_EVENT_YN, r.FR_GRADE_EVENT_YN, r.FIV_GRADE_EVENT_YN, r.SIX_GRADE_EVENT_YN]
    flags.forEach((f, i) => { if (f === 'Y') grades |= 1 << i })
    const detail = (r.EVENT_CNTNT || '').trim()

    const k = iso + '|' + name
    const prev = merged.get(k)
    if (prev) {
      prev.type = Math.max(prev.type, type)
      prev.grades |= grades
      if (detail && !prev.detail) prev.detail = detail
    } else {
      merged.set(k, { date: iso, name, type, grades, detail })
    }
  }
  return [...merged.values()].sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name, 'ko') : a.date < b.date ? -1 : 1))
}

// 학년도 구간 — 3월 1일부터 이듬해 2월 말까지. 기준일이 1·2월이면 전년도 학년도다.
export function schoolYearRange(baseIso) {
  const y = Number(baseIso.slice(0, 4))
  const m = Number(baseIso.slice(5, 7))
  const start = m >= 3 ? y : y - 1
  return { from: start + '-03-01', to: start + 1 + '-02-28' }
}

// ── 내장 데이터 (나이스가 응답하지 않을 때) ──────────────────────────────────
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
