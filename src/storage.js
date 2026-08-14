import { compute, subjectOf } from './logic.js'

const KEY = 'jindo.data.v1'

export const defaultData = () => ({
  setupDone: false,
  semStart: '',
  semEnd: '',
  classes: [],
  pattern: {}, // {'dow-period': '2-1'}  dow: 1(월)~5(금), period: 1~7
  colors: {}, // {'2-1': '#D5E7DC'} 반별 색 (없으면 순번 기본색)
  subjects: ['수학'], // 차시별 내용 과목 탭
  clsSubject: {}, // {'2-1': '수학'} 반→과목 (없으면 첫 과목)
  contents: {}, // {'수학': {'1': '집합의 뜻', ...}} 과목별 차시 내용
  events: [], // {id, start, end, name, type: '휴업일'|'행사'|'고사'|'개인', period?, cls?}
  cancels: {}, // {'iso|p': {reason}}
  memos: {}, // 구버전 칸별 메모 — 로드 시 contents로 이관됨
  cfg: {
    examReset: false,
    examId: null,
    anim: true,
  },
  ui: { dashOpen: true, contentsOpen: true, splitPct: 62 },
  introSeen: false,
})

// 저장본에 없는 필드는 기본값으로 채운다 — 예전 버전 파일도 그대로 열린다.
function normalize(d) {
  const base = defaultData()
  const out = {
    ...base,
    ...d,
    cfg: { ...base.cfg, ...(d.cfg || {}) },
    ui: { ...base.ui, ...(d.ui || {}) },
  }
  if (!Array.isArray(out.subjects) || !out.subjects.length) out.subjects = ['수학']
  return migrateMemos(out)
}

// 구버전 칸별 메모(iso|p)를 (반의 과목, 차시번호)의 차시별 내용으로 이관.
function migrateMemos(d) {
  const keys = Object.keys(d.memos || {})
  if (!keys.length) return d
  if (d.semStart && d.semEnd) {
    const { sessions } = compute(d)
    const contents = JSON.parse(JSON.stringify(d.contents || {}))
    for (const k of keys) {
      const s = sessions[k]
      if (!s || s.canceled || !s.num) continue
      const subj = subjectOf(d, s.cls)
      if (!subj) continue
      contents[subj] = contents[subj] || {}
      if (!contents[subj][s.num]) contents[subj][s.num] = d.memos[k]
    }
    return { ...d, contents, memos: {} }
  }
  return { ...d, memos: {} }
}

export function loadData() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultData()
    return normalize(JSON.parse(raw))
  } catch {
    return defaultData()
  }
}

export function saveData(data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

// 전체 데이터를 파일로 내보낸다. API 키는 담지 않는다 — 파일을 주고받아도 키가 새지 않도록.
export function exportJSON(data, today) {
  const payload = { app: 'jindo-manager', version: 1, savedAt: today, data }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  a.download = '진도계획표-' + today + '.json'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000) // 즉시 해제하면 다운로드가 취소될 수 있다
}

// 내보낸 파일({app,version,data})과 data 객체만 담긴 파일 둘 다 받는다
export function coerceData(parsed) {
  const d = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed
  if (!d || typeof d !== 'object' || !Array.isArray(d.classes) || typeof d.pattern !== 'object') {
    throw new Error('진도매니저 데이터 파일이 아닙니다.')
  }
  return normalize(d)
}

export async function importJSON(file) {
  let parsed
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('JSON 파일을 읽을 수 없습니다.')
  }
  return coerceData(parsed)
}

export const getApiKey = () => localStorage.getItem('jindo.apiKey') || ''
export const setApiKey = v => localStorage.setItem('jindo.apiKey', v)
export const getModel = () => localStorage.getItem('jindo.model') || 'google/gemini-2.5-flash'
export const setModel = v => localStorage.setItem('jindo.model', v)
