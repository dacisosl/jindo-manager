// 날짜 유틸과 차시 계산 로직.
// 원칙: 차시 번호는 저장하지 않는다. 시간표(pattern) + 일정(events) + 결손(cancels)에서 매번 파생 계산한다.

export const DAYS = '일월화수목금토'
export const TINTS = ['#E3EDE7', '#E6EBF4', '#F4ECDD', '#F2E7E3', '#EAE6F1', '#E9F0DF']

export const GREEN = '#0F5C4D'
export const INK = '#1A1A1A'
export const SUB = '#6B6B6B'
export const FAINT = '#9B9797'
export const LINE = '#D9D9D9'
export const LINE_SOFT = '#EFEDE9'
export const WARN = '#B4552D'

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

export function tintOf(classes, cls) {
  const i = classes.indexOf(cls)
  return i < 0 ? '#FFFFFF' : TINTS[i % TINTS.length]
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
  // '개인' 일정은 기록용 — 자동 결손을 만들지 않는다
  return data.events.filter(e => e.start <= iso && iso <= e.end && e.type !== '개인')
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
          sessions[key] = { cls, canceled: true, user: true, reason: uc.reason || '결손' }
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
}
