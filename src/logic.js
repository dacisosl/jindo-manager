// 날짜 유틸과 차시 계산 로직.
// 원칙: 차시 번호는 저장하지 않는다. 시간표(pattern) + 일정(events) + 결손(cancels)에서 매번 파생 계산한다.

export const DAYS = '일월화수목금토'

// 반 색상 팔레트 (스와치 선택용 12색, 뮤트 톤)
export const TINTS = [
  '#D5E7DC', '#D3DFF2', '#F2E2C4', '#F0D9CF', '#E0D8EF', '#DFEBCB',
  '#F0DBE8', '#CFE8E6', '#EDE1CB', '#D8E3D8', '#E6DCEF', '#EFE6C9',
]

export const GREEN = '#0F5C4D'
export const INK = '#1A1A1A'
export const SUB = '#575757'
export const FAINT = '#8F8B86'
export const LINE = '#C9C5BE'
export const LINE_SOFT = '#E4E1DA'
export const WARN = '#B4552D'
export const RED = '#C2412D'

// 화면 구획 제목 (요약 · 차시별 내용 · 일정 …)
export const SECTION_TITLE = { fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: INK }

export function toISO(d) {
  const p = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate())
}
export function fromISO(s) {
  const a = s.split('-').map(Number)
  return new Date(a[0], a[1] - 1, a[2])
}
export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export function md(iso) {
  const d = fromISO(iso)
  return d.getMonth() + 1 + '.' + d.getDate()
}

// 반 색: 사용자가 지정한 색 → 없으면 순번 기본색
export function colorOf(data, cls) {
  if (data.colors && data.colors[cls]) return data.colors[cls]
  const i = data.classes.indexOf(cls)
  return i < 0 ? '#FFFFFF' : TINTS[i % TINTS.length]
}

// 반의 과목: 지정 없으면 첫 과목
export function subjectOf(data, cls) {
  return (data.clsSubject && data.clsSubject[cls]) || (data.subjects && data.subjects[0]) || ''
}

// 기준 고사: 설정에서 고른 고사, 없으면 시작일이 가장 이른 '고사' 일정
export function pickExam(data) {
  const exams = data.events.filter(e => e.type === '고사').slice().sort((a, b) => (a.start < b.start ? -1 : 1))
  if (data.cfg.examId != null) {
    const found = exams.find(e => e.id === data.cfg.examId)
    if (found) return found
  }
  return exams[0] || null
}

function eventsOn(data, iso) {
  // 개인 일정(출장 등)도 수업이 빠지는 건 같으므로 모든 유형을 결손으로 본다
  return data.events.filter(e => e.start <= iso && iso <= e.end)
}

function cancelEventFor(data, iso, p, cls) {
  return eventsOn(data, iso).find(e => (!e.period || e.period === p) && (!e.cls || e.cls === cls))
}

// 학기 전체를 훑으며 각 (날짜|교시) 칸의 상태를 계산한다.
// sessions[iso|p] = {cls, num} | {cls, canceled, reason, user?}
// perClass[cls] = [{iso, p, num}...] (결손 제외, 순서대로)
export function compute(data) {
  const exam = pickExam(data)
  const sessions = {}
  const perClass = {}
  const counters = {}
  let d = fromISO(data.semStart)
  const end = fromISO(data.semEnd)
  while (d <= end) {
    const dow = d.getDay()
    if (dow >= 1 && dow <= 5) {
      const iso = toISO(d)
      for (let p = 1; p <= 7; p++) {
        const cls = data.pattern[dow + '-' + p]
        if (!cls) continue
        const key = iso + '|' + p
        const ev = cancelEventFor(data, iso, p, cls)
        if (ev) {
          sessions[key] = { cls, canceled: true, reason: ev.name }
          continue
        }
        const uc = data.cancels[key]
        if (uc) {
          // 수행평가도 차시를 소모하지 않는다 — 다만 결손이 아니라 수행평가로 표시된다
          const perf = uc.kind === 'perf'
          sessions[key] = { cls, canceled: true, user: true, perf, reason: uc.reason || (perf ? '수행평가' : '결손') }
          continue
        }
        const sec = data.cfg.examReset && exam && iso > exam.end ? 1 : 0
        const ck = sec + '|' + cls
        counters[ck] = (counters[ck] || 0) + 1
        const num = counters[ck]
        sessions[key] = { cls, num }
        ;(perClass[cls] = perClass[cls] || []).push({ iso, p, num })
      }
    }
    d = addDays(d, 1)
  }
  return { sessions, perClass, exam }
}

// 목표차시는 따로 설정하지 않는다 — 지금 구간(고사 리셋 반영)의 마지막 차시가 곧 목표.
export function sectionTarget(list, today) {
  if (!list || !list.length) return 0
  let i = -1
  for (let j = 0; j < list.length; j++) if (list[j].iso <= today) i = j
  let j = Math.max(i, 0)
  while (j + 1 < list.length && list[j + 1].num > list[j].num) j++
  return list[j].num
}

export function exportCSV(sessions) {
  const lines = [['date', 'period', 'class', 'session'].join(',')]
  Object.keys(sessions)
    .sort()
    .forEach(k => {
      const kv = k.split('|')
      const s = sessions[k]
      lines.push([kv[0], kv[1], s.cls, s.canceled ? '결손' : s.num].join(','))
    })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' }))
  a.download = '진도.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}
