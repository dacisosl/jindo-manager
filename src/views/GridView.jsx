import React, { useEffect, useRef, useState } from 'react'
import { DAYS, GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, WARN, addDays, fromISO, toISO, colorOf, subjectOf, sectionTarget } from '../logic.js'
import ContentsPanel from './ContentsPanel.jsx'
import useWindowWidth from '../useWindowWidth.js'

export default function GridView({ data, setData, computed, today, setSnack, go, goImport, weekOffset, setWeekOffset, stagger }) {
  const { sessions, perClass, exam } = computed
  const cfg = data.cfg
  const { isMobile } = useWindowWidth()
  const [pop, setPop] = useState(null) // {key, mode:'menu'|'edit', draft}
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSubject, setActiveSubject] = useState(data.subjects[0] || '수학')
  const [dragPct, setDragPct] = useState(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    const close = () => {
      setPop(null)
      setMenuOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const setUI = p => setData(d => ({ ...d, ui: { ...d.ui, ...p } }))
  const showContents = data.ui.contentsOpen
  const splitPct = Math.min(80, Math.max(35, dragPct ?? data.ui.splitPct))

  const startDrag = e => {
    e.preventDefault()
    const rect = wrapRef.current.getBoundingClientRect()
    const pctOf = x => Math.min(80, Math.max(35, ((x - rect.left) / rect.width) * 100))
    const move = ev => setDragPct(pctOf(ev.clientX))
    const up = ev => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
      setDragPct(null)
      setUI({ splitPct: Math.round(pctOf(ev.clientX)) })
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  const t = fromISO(today)
  const mon0 = addDays(t, 1 - (t.getDay() || 7))
  const mon = addDays(mon0, weekOffset * 7)
  const days = []
  for (let i = 0; i < 5; i++) {
    const d = addDays(mon, i)
    const iso = toISO(d)
    days.push({ iso, label: DAYS[d.getDay()] + ' ' + d.getDate(), isToday: iso === today })
  }
  const fri = addDays(mon, 4)
  const weekLabel = mon.getMonth() + 1 + '.' + mon.getDate() + ' – ' + (fri.getMonth() + 1) + '.' + fri.getDate()

  const semD = data.semStart ? fromISO(data.semStart) : t
  const semLabel = semD.getFullYear() + '-' + (semD.getMonth() + 1 >= 3 && semD.getMonth() + 1 <= 8 ? '1' : '2') + '학기'

  // 칸 내용 = 차시별 내용(contents)에서 파생. 칸에서 고치면 같은 과목·차시의 모든 칸에 반영된다.
  const contentOf = (cls, num) => {
    const subj = subjectOf(data, cls)
    return (data.contents[subj] || {})[num] || ''
  }
  const setContent = (cls, num, v) => {
    const subj = subjectOf(data, cls)
    setData(d => {
      const contents = { ...d.contents, [subj]: { ...(d.contents[subj] || {}) } }
      if (v) contents[subj][num] = v
      else delete contents[subj][num]
      return { ...d, contents }
    })
  }

  const doCancel = key => {
    const s = sessions[key]
    if (!s) return
    if (s.canceled && s.user) {
      setData(d => {
        const c = { ...d.cancels }
        delete c[key]
        return { ...d, cancels: c }
      })
      setPop(null)
      setSnack({ text: '결손을 해제했습니다.', kind: 'none' })
    } else if (!s.canceled) {
      const examStart = exam ? exam.start : null
      const cnt = (perClass[s.cls] || []).filter(x => x.num > s.num && (!examStart || x.iso < examStart)).length
      setData(d => ({ ...d, cancels: { ...d.cancels, [key]: { reason: '' } } }))
      setPop(null)
      setSnack({ text: s.num + '차시 이후 ' + cnt + '개 차시가 이동했습니다.', kind: 'cancel', key, canReason: true })
    }
  }

  let idx = 0
  const mkNum = num => {
    const i = idx++
    return (
      <span
        key={num + (stagger ? '-s' : '')}
        style={{
          display: 'inline-block', fontSize: 20, fontWeight: 700, lineHeight: 1.15,
          animation: cfg.anim ? 'numSlide 200ms ease both' : 'none',
          animationDelay: stagger ? i * 40 + 'ms' : '0ms',
        }}
      >
        {num}
      </span>
    )
  }

  const rows = []
  for (let p = 1; p <= 7; p++) {
    const cells = days.map(day => {
      const key = day.iso + '|' + p
      const s = sessions[key]
      const cont = s && !s.canceled ? contentOf(s.cls, s.num) : ''
      const clickable = !!(s && (!s.canceled || s.user))
      const popOpen = !!(pop && pop.key === key)
      return (
        <div
          key={key}
          onClick={clickable ? e => { e.stopPropagation(); setPop({ key, mode: 'menu', draft: cont }); setMenuOpen(false) } : undefined}
          style={{
            position: 'relative', minHeight: 64, padding: '9px 12px', boxSizing: 'border-box',
            borderTop: '1px solid ' + LINE_SOFT, borderLeft: '1px solid ' + LINE_SOFT,
            cursor: clickable ? 'pointer' : 'default',
            boxShadow: day.isToday ? 'inset 1px 0 0 rgba(15,92,77,0.4), inset -1px 0 0 rgba(15,92,77,0.4)' : 'none',
            background: s && !s.canceled ? colorOf(data, s.cls) : '#FFFFFF',
          }}
        >
          {s && !s.canceled && (
            <>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{s.cls}</div>
              <div style={{ marginTop: 1 }}>{mkNum(s.num)}</div>
              <input
                value={cont}
                onChange={e => setContent(s.cls, s.num, e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder="내용"
                style={{ width: '100%', boxSizing: 'border-box', border: 'none', background: 'transparent', fontSize: 12, color: SUB, padding: 0, marginTop: 3 }}
              />
            </>
          )}
          {s && s.canceled && (
            <>
              <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,transparent 0,transparent 5px,rgba(26,26,26,0.06) 5px,rgba(26,26,26,0.06) 6px)' }} />
              <div style={{ position: 'relative', fontSize: 14, fontWeight: 600, color: FAINT, lineHeight: 1.3 }}>{s.cls}</div>
              <div style={{ position: 'relative', fontSize: 12, color: SUB, marginTop: 4 }}>{s.reason}</div>
            </>
          )}
          {popOpen && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', left: 8, top: 'calc(100% - 8px)', width: 210, background: '#FFFFFF',
                border: '1px solid ' + LINE, borderRadius: 6, boxShadow: '0 8px 24px rgba(26,26,26,0.12)',
                zIndex: 50, textAlign: 'left', cursor: 'default',
              }}
            >
              <div style={{ padding: '9px 14px', fontSize: 13, color: SUB, borderBottom: '1px solid ' + LINE_SOFT }}>
                {popTitle(pop.key, sessions)}
              </div>
              {pop.mode === 'menu' && (
                <>
                  <div className="hov2" onClick={() => doCancel(key)} style={{ padding: '9px 14px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                    {s && s.canceled ? '결손 해제' : '결손 처리'}
                  </div>
                  <div className="hov2" onClick={() => setPop({ ...pop, mode: 'edit' })} style={{ padding: '9px 14px 11px', fontSize: 14, cursor: 'pointer' }}>
                    내용 편집
                  </div>
                </>
              )}
              {pop.mode === 'edit' && (
                <div style={{ padding: '11px 14px 12px' }}>
                  <input
                    value={pop.draft}
                    onChange={e => setPop({ ...pop, draft: e.target.value })}
                    placeholder="내용"
                    autoFocus
                    style={{ width: '100%', boxSizing: 'border-box', border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 13, padding: '4px 0' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <button
                      onClick={() => { if (s && s.num) setContent(s.cls, s.num, pop.draft); setPop(null) }}
                      style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: GREEN }}
                    >
                      저장
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )
    })
    rows.push(
      <div key={p} style={{ display: 'contents' }}>
        <div style={{ borderTop: '1px solid ' + LINE_SOFT, padding: '10px 0 0 13px', fontSize: 12, color: FAINT }}>{p}</div>
        {cells}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <DashStrip data={data} computed={computed} today={today} setUI={setUI} setWeekOffset={setWeekOffset} mon0={mon0} isMobile={isMobile} />

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, paddingBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{semLabel}</div>
        <button onClick={() => go('timetable')} data-print="hide" style={linkBtn}>시간표</button>
        <button onClick={() => go('schedule')} data-print="hide" style={linkBtn}>일정</button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: SUB }}>{weekLabel}</div>
        <div data-print="hide" style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <button className="hov" onClick={() => { setWeekOffset(weekOffset - 1); setPop(null) }} style={navBtn(15)}>‹</button>
          <button className="hov" onClick={() => { setWeekOffset(0); setPop(null) }} style={navBtn(13)}>오늘</button>
          <button className="hov" onClick={() => { setWeekOffset(weekOffset + 1); setPop(null) }} style={navBtn(15)}>›</button>
          <div style={{ position: 'relative' }}>
            <button
              className="hov"
              onClick={e => { e.stopPropagation(); setMenuOpen(!menuOpen); setPop(null) }}
              style={{ ...navBtn(15), letterSpacing: '0.05em' }}
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                onClick={e => e.stopPropagation()}
                style={{ position: 'absolute', right: 0, top: 32, width: 172, background: '#FFFFFF', border: '1px solid ' + LINE, borderRadius: 6, boxShadow: '0 8px 24px rgba(26,26,26,0.12)', padding: '6px 0', zIndex: 50 }}
              >
                <div className="hov2" onClick={() => { setMenuOpen(false); setTimeout(() => window.print(), 100) }} style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>인쇄</div>
                <div className="hov2" onClick={() => { setMenuOpen(false); goImport('timetable') }} style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>파일에서 가져오기</div>
              </div>
            )}
          </div>
          <button
            onClick={() => setUI({ contentsOpen: !showContents })}
            style={{ ...navBtn(13), color: showContents ? GREEN : SUB, fontWeight: showContents ? 600 : 400, whiteSpace: 'nowrap' }}
          >
            차시별 내용
          </button>
        </div>
      </div>

      <div ref={wrapRef} style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ width: showContents && !isMobile ? splitPct + '%' : '100%', minWidth: 0, flex: 'none' }}>
          <div className="table-scroll">
            <div className="table-min" style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(5,1fr)' }}>
                <div />
                {days.map(day => (
                  <div key={day.iso} style={{ padding: '11px 12px 9px', borderLeft: '1px solid ' + LINE_SOFT, fontSize: 13, color: day.isToday ? GREEN : SUB }}>
                    <span style={{ borderBottom: '2px solid ' + (day.isToday ? GREEN : 'transparent'), paddingBottom: 3, fontWeight: 600 }}>{day.label}</span>
                  </div>
                ))}
                {rows}
              </div>
            </div>
          </div>
          {exam && toISO(fri) < exam.start && (
            <div style={{ marginTop: 22, borderTop: '1px solid ' + LINE, paddingTop: 8, fontSize: 12, color: FAINT }}>
              {exam.name} 이전 구간
            </div>
          )}
        </div>
        {showContents && !isMobile && (
          <div
            data-print="hide"
            onMouseDown={startDrag}
            title="드래그해서 너비 조절"
            style={{ width: 16, cursor: 'col-resize', display: 'flex', justifyContent: 'center', flex: 'none' }}
          >
            <div style={{ width: 2, background: dragPct != null ? GREEN : LINE, borderRadius: 1 }} />
          </div>
        )}
        {showContents && !isMobile && (
          <div data-print="hide" style={{ flex: 1, minWidth: 0, paddingLeft: 6 }}>
            <ContentsPanel data={data} setData={setData} computed={computed} today={today} active={activeSubject} setActive={setActiveSubject} />
          </div>
        )}
      </div>
      {showContents && isMobile && (
        <div data-print="hide" style={{ marginTop: 26 }}>
          <ContentsPanel data={data} setData={setData} computed={computed} today={today} active={activeSubject} setActive={setActiveSubject} />
        </div>
      )}
    </div>
  )
}

// 대시보드 스트립: 오늘의 수업 · 반별 차시 현황 · 고사 D-day를 가로 한 줄에.
function DashStrip({ data, computed, today, setUI, setWeekOffset, mon0, isMobile }) {
  const { sessions, perClass, exam } = computed
  const open = data.ui.dashOpen
  const todayD = fromISO(today)
  const dateLabel = todayD.getMonth() + 1 + '.' + todayD.getDate() + ' ' + DAYS[todayD.getDay()]

  const todayRows = []
  for (let p = 1; p <= 7; p++) {
    const s = sessions[today + '|' + p]
    if (s && !s.canceled) todayRows.push({ p, cls: s.cls, num: s.num })
  }

  const curOf = c => {
    const l = (perClass[c] || []).filter(x => x.iso <= today)
    return l.length ? l[l.length - 1].num : 0
  }
  const maxCur = Math.max(...data.classes.map(curOf), 0)

  const goBehind = c => {
    const ent = Object.entries(sessions).find(kv => kv[1].cls === c && kv[1].canceled)
    if (!ent) return
    const iso = ent[0].split('|')[0]
    const dm = fromISO(iso)
    const m = addDays(dm, 1 - (dm.getDay() || 7))
    setWeekOffset(Math.round((m - mon0) / (7 * 86400000)))
  }

  const dday = exam ? Math.round((fromISO(exam.start) - todayD) / 86400000) : null
  const remain = exam
    ? data.classes.map(c => c + ' ' + (perClass[c] || []).filter(x => x.iso > today && x.iso < exam.start).length).join(' · ')
    : ''

  const label = { fontSize: 12, fontWeight: 600, color: FAINT, flex: 'none' }

  return (
    <div data-print="hide" style={{ borderBottom: '1px solid ' + LINE, marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <button
          onClick={() => setUI({ dashOpen: !open })}
          style={{ border: 'none', background: 'none', padding: '2px 0', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: FAINT }}
        >
          {open ? '▾' : '▸'} 대시보드
        </button>
        {!open && <span style={{ fontSize: 12, color: FAINT }}>{dateLabel}</span>}
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 36, padding: '10px 0 14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <span style={label}>오늘 {dateLabel}</span>
            {todayRows.length === 0 && <span style={{ fontSize: 13, color: SUB }}>수업 없음</span>}
            {todayRows.map(r => (
              <span key={r.p} style={{ fontSize: 13, color: INK, whiteSpace: 'nowrap' }}>
                <span style={{ color: SUB }}>{r.p}교시</span>{' '}
                <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: colorOf(data, r.cls), border: '1px solid rgba(26,26,26,0.14)', margin: '0 4px 0 2px' }} />
                <b style={{ fontWeight: 600 }}>{r.cls}</b> {r.num}차시
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
            <span style={label}>차시 현황</span>
            {data.classes.map(c => {
              const cur = curOf(c)
              const total = sectionTarget(perClass[c], today)
              const behind = maxCur - cur
              return (
                <span key={c} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: colorOf(data, c), border: '1px solid rgba(26,26,26,0.14)', marginRight: 4 }} />
                  <b style={{ fontWeight: 600 }}>{c}</b> {cur}<span style={{ color: FAINT }}>/{total}</span>
                  {behind > 0 && (
                    <button onClick={() => goBehind(c)} style={{ border: 'none', background: 'none', padding: 0, marginLeft: 5, cursor: 'pointer', fontSize: 12, color: WARN }}>
                      뒤처짐 {behind}
                    </button>
                  )}
                </span>
              )
            })}
          </div>
          {exam && (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <span style={label}>{exam.name}</span>
              <span style={{ fontSize: 13 }}>
                <b style={{ fontWeight: 700 }}>D-{dday}</b>
                <span style={{ color: SUB, marginLeft: 8 }}>남은 차시 {remain}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function popTitle(key, sessions) {
  const [iso, ps] = key.split('|')
  const s = sessions[key]
  if (!s) return ''
  const dd = fromISO(iso)
  return s.cls + ' · ' + DAYS[dd.getDay()] + ' ' + ps + '교시' + (s.num ? ' · ' + s.num + '차시' : '')
}

const linkBtn = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: GREEN }
const navBtn = fs => ({ border: 'none', background: 'none', padding: fs === 15 ? '3px 9px' : '4px 9px', borderRadius: 6, cursor: 'pointer', fontSize: fs, lineHeight: 1 })
