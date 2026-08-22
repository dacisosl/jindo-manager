import React, { useEffect, useMemo, useRef, useState } from 'react'
import { DAYS, GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, WARN, fromISO, toISO } from '../logic.js'
import {
  EVENT_TYPES, loadSchoolIndex, loadSchoolEvents, searchSchools, toAppEvents,
  neisSearchSchools, neisSchedule, schoolYearRange,
} from '../schools.js'
import Modal from './Modal.jsx'

// 전국 학사일정 검색 — 학교를 찾아 그 학교 일정을 골라 넣는다.
// 나이스 오픈API를 실시간으로 조회하고, 나이스가 응답하지 않으면 내장 데이터로 전환한다.
// 이 앱에서는 일정이 곧 결손이므로, 수업이 실제로 빠지는 휴업일·고사만 처음부터 골라 둔다.
// 행사는 학교마다 수업을 하기도 해서 사용자가 직접 고른다.
export default function SchoolCalendarModal({ data, setData, setSnack, onClose }) {
  const [mode, setMode] = useState('neis') // neis | local (나이스 실패 시 내장 데이터)
  const [index, setIndex] = useState(null) // 내장 데이터 목록 — local 모드에서만 쓴다
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [level, setLevel] = useState(null)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [school, setSchool] = useState(null)
  const [events, setEvents] = useState(null) // null = 불러오는 중
  const [grade, setGrade] = useState(0) // 0 = 전학년
  const [picked, setPicked] = useState(() => new Set())
  const [types, setTypes] = useState({}) // 사용자가 바꾼 유형 {i: 0|1|2}
  const [hasPreset, setHasPreset] = useState(false) // 휴업일·고사가 있어 미리 골라 준 학교인지
  const seq = useRef(0) // 늦게 온 검색 결과가 최신 입력을 덮지 않게

  // 나이스가 안 될 때 내장 데이터로 내려앉는다 — 같은 질의를 이어서 처리한다
  const fallbackToLocal = async (query, my) => {
    try {
      const idx = index || (await loadSchoolIndex())
      if (!index) setIndex(idx)
      setMode('local')
      if (my !== seq.current) return
      setResults(searchSchools(idx.schools, query, { level }))
      setError('나이스에 연결하지 못해 내장 데이터로 검색합니다.')
    } catch {
      if (my === seq.current) setError('나이스에 연결하지 못했고 내장 데이터도 읽지 못했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  // 입력을 잠깐 기다렸다가 검색한다. 나이스는 두 글자부터 (한 글자는 결과가 수백 개라 의미가 없다)
  useEffect(() => {
    const query = q.trim()
    const my = ++seq.current
    if (!query || (mode === 'neis' && query.length < 2)) {
      setResults([])
      setSearching(false)
      return
    }
    if (mode === 'local') {
      if (index) setResults(searchSchools(index.schools, query, { level }))
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const list = await neisSearchSchools(query)
        if (my !== seq.current) return
        setResults(level == null ? list : list.filter(s => s.level === level))
        setError('')
      } catch {
        await fallbackToLocal(query, my)
      } finally {
        if (my === seq.current) setSearching(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [q, level, mode, index])

  const semStart = data.semStart
  const semEnd = data.semEnd
  const hasSem = !!(semStart && semEnd && semStart < semEnd)
  const inSem = iso => !hasSem || (semStart <= iso && iso <= semEnd)
  // 이미 넣어 둔 일정인지 — 기간 일정(고사 3일 등)은 그 안의 날짜도 같은 일정으로 본다
  const already = useMemo(() => {
    const list = data.events.map(e => ({ name: e.name, start: e.start, end: e.end || e.start }))
    return (date, name) => list.some(e => e.name === name && e.start <= date && date <= e.end)
  }, [data.events])

  const open = async s => {
    setSchool(s)
    setEvents(null)
    setPicked(new Set())
    setTypes({})
    setGrade(0)
    try {
      let evs
      if (s.src === 'neis') {
        // 학기가 걸친 학년도 전체를 받아 온다 — 학기 밖 일정도 흐리게나마 보이도록
        const { from, to } = schoolYearRange(hasSem ? semStart : toISO(new Date()))
        evs = await neisSchedule(s, from, to)
      } else {
        evs = await loadSchoolEvents(s.region, s.key)
      }
      setEvents(evs)
      // 처음 고름: 수업이 빠지는 휴업일·고사 중, 학기 안에 있고 아직 없는 것
      const init = new Set()
      evs.forEach((ev, i) => {
        if (ev.type !== 0 && inSem(ev.date) && !already(ev.date, ev.name)) init.add(i)
      })
      setPicked(init)
      setHasPreset(init.size > 0)
    } catch {
      setEvents([])
      setError('일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  const back = () => { setSchool(null); setEvents(null); setError('') }

  const typeOf = i => (types[i] != null ? types[i] : events[i].type)
  const cycleType = i => setTypes(t => ({ ...t, [i]: (typeOf(i) + 1) % 3 }))
  const toggle = i => setPicked(p => {
    const n = new Set(p)
    n.has(i) ? n.delete(i) : n.add(i)
    return n
  })

  // 학년 필터 — 그 학교 일정에 실제로 표시된 학년만 칩으로 보여준다
  const grades = useMemo(() => {
    if (!events) return []
    let mask = 0
    for (const ev of events) mask |= ev.grades
    return [1, 2, 3, 4, 5, 6].filter(g => mask & (1 << (g - 1)))
  }, [events])

  const rows = useMemo(() => {
    if (!events) return []
    return events
      .map((ev, i) => ({ ev, i }))
      .filter(({ ev }) => !grade || !ev.grades || ev.grades & (1 << (grade - 1)))
  }, [events, grade])

  const outOfSem = rows.filter(({ ev }) => !inSem(ev.date)).length
  const pickedRows = rows.filter(({ i }) => picked.has(i))

  const setAll = on => setPicked(p => {
    const n = new Set(p)
    rows.forEach(({ i, ev }) => {
      if (on) { if (inSem(ev.date)) n.add(i) } else n.delete(i)
    })
    return n
  })

  const apply = () => {
    const chosen = pickedRows.map(({ ev, i }) => ({ ...ev, type: typeOf(i) }))
    if (!chosen.length) return
    const evs = toAppEvents(chosen)
    const prev = data.events
    setData(d => ({ ...d, events: [...d.events, ...evs] }))
    setSnack({ text: school.name + ' 학사일정 ' + evs.length + '건을 넣었습니다.', kind: 'events', prev })
    onClose()
  }

  // 화면에 보여줄 조회 기간 — 나이스는 학년도 전체, 내장 데이터는 담긴 범위
  const yr = schoolYearRange(hasSem ? semStart : toISO(new Date()))
  const period = mode === 'neis'
    ? yr.from.replace(/-/g, '.') + ' ~ ' + yr.to.replace(/-/g, '.')
    : index ? index.meta.start.replace(/-/g, '.') + ' ~ ' + index.meta.end.replace(/-/g, '.') : ''

  return (
    <Modal title="학사일정 검색" onClose={onClose} width={640}>
      {!school ? (
        <>
          <div style={{ marginTop: 6, fontSize: 13, color: SUB }}>
            학교 이름을 검색하면 나이스에 등록된 학사일정을 그대로 가져옵니다.
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 14 }}>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder={mode === 'neis' ? '학교 이름 (두 글자 이상)' : '학교 이름 (초성도 됩니다)'}
              autoFocus
              style={{ flex: 1, minWidth: 0, border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', fontSize: 14, padding: '8px 10px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {[[null, '전체'], [1, '초등학교'], [2, '중학교'], [3, '고등학교']].map(([v, label]) => (
              <button key={label} onClick={() => setLevel(v)} style={chip(level === v)}>{label}</button>
            ))}
          </div>

          {error && <div style={{ marginTop: 14, fontSize: 13, color: WARN }}>{error}</div>}

          <div className="soft-scroll" style={{ marginTop: 14, maxHeight: 320, overflowY: 'auto' }}>
            {searching && <div style={{ fontSize: 13, color: FAINT, padding: '10px 0' }}>찾는 중…</div>}
            {!searching && q.trim().length >= 2 && !results.length && !error && (
              <div style={{ fontSize: 13, color: FAINT, padding: '10px 0' }}>찾는 학교가 없습니다. 이름을 줄여서 검색해보세요.</div>
            )}
            {results.map(s => (
              <button
                key={s.key}
                onClick={() => open(s)}
                className="hov"
                style={{
                  display: 'flex', alignItems: 'baseline', gap: 8, width: '100%', textAlign: 'left',
                  border: 'none', borderBottom: '1px solid ' + LINE_SOFT, background: 'none',
                  padding: '10px 4px', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{s.name}</span>
                <span style={{ fontSize: 12, color: FAINT }}>{s.levelName}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: FAINT }}>{s.regionName.replace('교육청', '')}</span>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: FAINT, lineHeight: 1.6 }}>
            {mode === 'neis'
              ? '나이스(교육행정정보시스템)에 등록된 학사일정을 실시간으로 조회합니다. 조회 기간 ' + period + '.'
              : index
                ? '내장 데이터로 검색 중입니다. 담긴 기간은 ' + period + ' · 학교 ' + index.schools.length.toLocaleString() + '곳.'
                : ''}
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}>
            <button onClick={back} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: GREEN, flex: 'none' }}>← 다시 검색</button>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 14, fontWeight: 700 }}>{school.name}</span>
            <span style={{ fontSize: 12, color: FAINT }}>{school.levelName}</span>
          </div>

          {events === null && <div style={{ marginTop: 18, fontSize: 13, color: SUB }}>일정을 불러오는 중…</div>}

          {events && !events.length && (
            <div style={{ marginTop: 18, fontSize: 13, color: error ? WARN : SUB }}>
              {error || '이 학교는 ' + period + ' 사이에 등록된 평일 일정이 없습니다.'}
            </div>
          )}

          {events && !!events.length && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                {!!grades.length && (
                  <>
                    <button onClick={() => setGrade(0)} style={chip(grade === 0)}>전학년</button>
                    {grades.map(g => (
                      <button key={g} onClick={() => setGrade(g)} style={chip(grade === g)}>{g}학년</button>
                    ))}
                  </>
                )}
                <span style={{ flex: 1 }} />
                <button onClick={() => setAll(true)} style={linkBtn}>모두 고르기</button>
                <button onClick={() => setAll(false)} style={linkBtn}>모두 풀기</button>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: FAINT, lineHeight: 1.6 }}>
                넣은 일정은 그 날 수업을 결손 처리합니다.{' '}
                {hasPreset
                  ? '그래서 휴업일·고사만 미리 골라 두었습니다 — 수업이 실제로 빠지는 행사만 더 고르세요.'
                  : '이 학교는 이 기간에 휴업일·고사가 없어 미리 고른 것이 없습니다 — 수업이 실제로 빠지는 행사만 골라주세요.'}
                {' '}유형 배지를 누르면 행사·휴업일·고사로 바꿀 수 있습니다.
              </div>

              <div className="soft-scroll" style={{ marginTop: 8, maxHeight: 340, overflowY: 'auto', borderTop: '1px solid ' + LINE }}>
                {rows.map(({ ev, i }) => {
                  const dup = already(ev.date, ev.name)
                  const out = !inSem(ev.date)
                  const d = fromISO(ev.date)
                  const on = picked.has(i)
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'grid', gridTemplateColumns: '18px 78px 1fr auto', gap: 8, alignItems: 'center',
                        padding: '9px 2px', borderBottom: '1px solid ' + LINE_SOFT, opacity: out ? 0.45 : 1,
                      }}
                    >
                      <input type="checkbox" checked={on} onChange={() => toggle(i)} style={{ accentColor: GREEN, width: 15, height: 15, margin: 0, cursor: 'pointer' }} />
                      <div style={{ fontSize: 12.5, color: SUB }}>
                        {d.getMonth() + 1}.{d.getDate()} {DAYS[d.getDay()]}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.name}
                          {dup && <span style={{ marginLeft: 6, fontSize: 11, color: FAINT }}>이미 등록됨</span>}
                          {out && <span style={{ marginLeft: 6, fontSize: 11, color: FAINT }}>학기 밖</span>}
                        </div>
                        {!!ev.detail && (
                          <div style={{ fontSize: 11.5, color: FAINT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.detail}</div>
                        )}
                      </div>
                      <button onClick={() => cycleType(i)} title="유형 바꾸기" style={badge(typeOf(i))}>
                        {EVENT_TYPES[typeOf(i)]}
                      </button>
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
                <div style={{ fontSize: 12.5, color: FAINT }}>
                  {pickedRows.length}건 선택
                  {hasSem && outOfSem > 0 && ' · 학기 밖 ' + outOfSem + '건은 넣어도 계산에 쓰이지 않습니다'}
                  {!hasSem && ' · 학기 기간을 먼저 정하면 학기 밖 일정을 걸러줍니다'}
                </div>
                <div style={{ flex: 1 }} />
                <button
                  onClick={apply}
                  disabled={!pickedRows.length}
                  style={{
                    border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 14, fontWeight: 700,
                    background: pickedRows.length ? GREEN : '#D9D5CE', color: '#FFFFFF',
                    cursor: pickedRows.length ? 'pointer' : 'default', flex: 'none',
                  }}
                >
                  넣기
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  )
}

const chip = on => ({
  border: '1px solid ' + (on ? '#CBDED7' : LINE), borderRadius: 999, padding: '5px 11px', cursor: 'pointer',
  background: on ? '#EAF1EE' : '#FFFFFF', color: on ? GREEN : SUB, fontSize: 12.5, fontWeight: on ? 700 : 500, flex: 'none',
})

const linkBtn = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, color: GREEN, flex: 'none' }

const BADGE = [
  { bg: '#F4E8CE', fg: '#854F0B' }, // 행사
  { bg: '#E2E8E2', fg: '#3F5C4C' }, // 휴업일
  { bg: '#F6E0DC', fg: '#A32D2D' }, // 고사
]
const badge = t => ({
  border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', flex: 'none',
  fontSize: 10.5, fontWeight: 700, lineHeight: 1, background: BADGE[t].bg, color: BADGE[t].fg,
})
