// 해밀고 교사별 시간표 엑셀 → public/teachers.json 프리셋 생성
//   node scripts/build-teachers.mjs "<교사별시간표.xlsx>"
// 엑셀 구조: 교사 블록이 좌우 2열로 배치. 각 블록은 [이름, 월~금] 헤더 + 1~7교시 행.
// 칸 내용은 "2-1\nA_역학" 형태 (반 + 과목, 과목 앞 'A_'는 분반 표시).
import { readFileSync, writeFileSync } from 'node:fs'
import * as XLSX from 'xlsx/xlsx.mjs'

const SEM_START = '2026-08-13'
const SEM_END = '2026-12-31'
const BLOCK_COLS = [0, 7] // 교사 블록이 시작하는 열
const SKIP_SUBJECTS = ['창체', '창진'] // 창의적 체험활동 등은 교과 진도가 아니라 제외

// 학사일정 (2026-2학기). 주말은 애초에 수업이 없으므로 평일 일정만 담는다.
const EVENTS = [
  { start: '2026-08-13', end: '2026-08-13', name: '개학식', type: '행사' },
  { start: '2026-08-17', end: '2026-08-17', name: '대체공휴일', type: '휴업일' },
  { start: '2026-09-02', end: '2026-09-02', name: '모의고사·학력평가', type: '행사' },
  { start: '2026-09-24', end: '2026-09-25', name: '추석 연휴', type: '휴업일' },
  { start: '2026-10-05', end: '2026-10-05', name: '대체공휴일', type: '휴업일' },
  { start: '2026-10-06', end: '2026-10-08', name: '2학기 1회고사', type: '고사' },
  { start: '2026-10-09', end: '2026-10-09', name: '한글날', type: '휴업일' },
  { start: '2026-10-20', end: '2026-10-20', name: '전국연합학력평가', type: '행사' },
  { start: '2026-11-19', end: '2026-11-20', name: '재량휴업일', type: '휴업일' },
  { start: '2026-12-07', end: '2026-12-10', name: '2학기 2회고사', type: '고사' },
  { start: '2026-12-25', end: '2026-12-25', name: '성탄절', type: '휴업일' },
  { start: '2026-12-28', end: '2026-12-28', name: '축제 및 동아리 한마당', type: '행사' },
  { start: '2026-12-31', end: '2026-12-31', name: '방학식', type: '행사' },
]

const src = process.argv[2]
if (!src) {
  console.error('사용법: node scripts/build-teachers.mjs "<교사별시간표.xlsx>"')
  process.exit(1)
}

const wb = XLSX.read(readFileSync(src))
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })

const clean = v => String(v ?? '').replace(/ /g, ' ').trim()

// "2-1\nA_역학" → {cls:'2-1', subject:'역학'}
function parseCell(raw) {
  const txt = clean(raw)
  if (!txt) return null
  const parts = txt.split(/\r?\n/).map(clean).filter(Boolean)
  const cls = parts.find(p => /^\d+-\d+$/.test(p))
  if (!cls) return null
  const rest = parts.filter(p => p !== cls).join(' ')
  const subject = clean(rest.replace(/^[A-Z]_/, '')) || '수업'
  return { cls, subject }
}

const teachers = []
for (let r = 0; r < rows.length; r++) {
  for (const c of BLOCK_COLS) {
    const name = clean(rows[r]?.[c])
    if (!name || clean(rows[r]?.[c + 1]) !== '월') continue

    const pattern = {}
    const subjectsOf = {} // 반 → {과목: 횟수}
    for (let p = 1; p <= 7; p++) {
      const line = rows[r + p]
      if (!line) continue
      for (let dow = 1; dow <= 5; dow++) {
        const cell = parseCell(line[c + dow])
        if (!cell || SKIP_SUBJECTS.includes(cell.subject)) continue
        const key = cell.cls + '|' + cell.subject
        subjectsOf[cell.cls] = subjectsOf[cell.cls] || {}
        subjectsOf[cell.cls][cell.subject] = (subjectsOf[cell.cls][cell.subject] || 0) + 1
        pattern[dow + '-' + p] = key
      }
    }
    if (!Object.keys(pattern).length) continue

    // 한 반을 두 과목으로 가르치면 진도가 따로 가므로 "2-2 독작"처럼 나눠 부른다.
    const label = {}
    for (const [cls, subs] of Object.entries(subjectsOf)) {
      const names = Object.keys(subs)
      for (const s of names) label[cls + '|' + s] = names.length > 1 ? cls + ' ' + s : cls
    }

    const finalPattern = {}
    for (const [slot, key] of Object.entries(pattern)) finalPattern[slot] = label[key]

    const classes = []
    const clsSubject = {}
    for (const [key, name2] of Object.entries(label)) {
      if (!Object.values(finalPattern).includes(name2)) continue
      if (!classes.includes(name2)) classes.push(name2)
      clsSubject[name2] = key.split('|')[1]
    }
    classes.sort()

    const subjects = [...new Set(classes.map(cl => clsSubject[cl]))]

    teachers.push({
      name,
      data: {
        setupDone: true,
        semStart: SEM_START,
        semEnd: SEM_END,
        classes,
        pattern: finalPattern,
        colors: {},
        subjects,
        clsSubject,
        contents: {},
        events: EVENTS.map((e, i) => ({ id: 20260000 + i, ...e })),
        cancels: {},
        cfg: { examReset: false, examId: null, anim: true, dash: { today: true, progress: true, exam: true }, printScale: 'l' },
      },
    })
  }
}

teachers.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
const out = {
  _comment: '해밀고 교사 프리셋 — scripts/build-teachers.mjs 로 생성. 2026-2학기 시간표 및 학사일정 반영.',
  school: '해밀고등학교',
  semester: '2026-2학기',
  teachers,
}
writeFileSync('public/teachers.json', JSON.stringify(out, null, 1), 'utf8')

console.log('교사', teachers.length + '명')
console.log('예시:', teachers.slice(0, 3).map(t => t.name + '(' + t.data.classes.length + '반, 주 ' + Object.keys(t.data.pattern).length + '시간)').join(' · '))
const weird = teachers.filter(t => Object.keys(t.data.pattern).length < 5 || t.data.classes.length > 12)
if (weird.length) console.log('확인 필요:', weird.map(t => t.name + ':' + Object.keys(t.data.pattern).length).join(', '))
