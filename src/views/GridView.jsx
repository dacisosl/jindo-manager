import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DAYS, GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, WARN, RED, addDays, fromISO, toISO, colorOf, subjectOf, sectionTarget } from '../logic.js'
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
  const [gridH, setGridH] = useState(null)
  const wrapRef = useRef(null)
  const gridRef = useRef(null)

  useEffect(() => {
    const close = () => {
      setPop(null)
      setMenuOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  // 차시별 내용 패널 높이를 진도표에 맞춘다 (넘치는 내용은 패널 안에서 스크롤).
  useLayoutEffect(() => {
    if (!gridRef.current || isMobile) {
      setGridH(null)
      return
    }
    const measure = () => gridRef.current && setGridH(gridRef.current.getBoundingClientRect().height)
    measure() // ResizeObserver는 비동기라 첫 값은 직접 잰다
    const ro = new ResizeObserver(measure)
    ro.observe(gridRef.current)
    return () => ro.disconnect()
  }, [isMobile])

  // 주간 이동·결손 처리로 표 높이가 바뀌면 패널 높이도 따라간다
  useLayoutEffect(() => {
    if (gridRef.current && !isMobile) setGridH(gridRef.current.getBoundingClientRect().height)
  })

  const setUI = p => setData(d => ({ ...d, ui: { ...d.ui, ...p } }))
  const showContents = data.ui.contentsOpen
  const splitPct = Math.min(78, Math.max(38, dragPct ?? data.ui.splitPct))

  const startDrag = e => {
    e.preventDefault()
    const rect = wrapRef.current.getBoundingClientRect()
    const pctOf = x => Math.min(78, Math.max(38, ((x - rect.left) / rect.width) * 100))
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

  const clearCancel = (key, msg) => {
    setData(d => {
      const c = { ...d.cancels }
      delete c[key]
      return { ...d, cancels: c }
    })
    setPop(null)
    setSnack({ text: msg, kind: 'none' })
  }

  // 결손·수행평가 모두 차시를 소모하지 않으므로 뒤 차시가 밀린다.
  const markCell = (key, kind) => {
    const s = sessions[key]
    if (!s || !s.num) return
    const examStart = exam ? exam.start : null
    const cnt = (perClass[s.cls] || []).filter(x => x.num > s.num && (!examStart || x.iso < examStart)).length
    setData(d => ({ ...d, cancels: { ...d.cancels, [key]: { reason: '', kind } } }))
    setPop(null)
    setSnack({
      text: (kind === 'perf' ? '수행평가로 표시했습니다. ' : '') + s.num + '차시 이후 ' + cnt + '개 차시가 이동했습니다.',
      kind: 'cancel', key, canReason: kind !== 'perf',
    })
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
      const perf = !!(s && s.perf)
      return (
        <div
          key={key}
          onClick={clickable ? e => { e.stopPropagation(); setPop({ key, mode: 'menu', draft: cont }); setMenuOpen(false) } : undefined}
          style={{
            position: 'relative', minHeight: 62, padding: '8px 10px', boxSizing: 'border-box', minWidth: 0,
            borderTop: '1px solid ' + LINE_SOFT, borderLeft: '1px solid ' + LINE_SOFT,
            cursor: clickable ? 'pointer' : 'default',
            boxShadow: day.isToday ? 'inset 1px 0 0 rgba(15,92,77,0.4), inset -1px 0 0 rgba(15,92,77,0.4)' : 'none',
            background: s && (!s.canceled || perf) ? colorOf(data, s.cls) : '#FFFFFF',
          }}
        >
          {s && !s.canceled && (
            <>
              <div style={ellip(14, 600)}>{s.cls}</div>
              <div style={{ marginTop: 1 }}>{mkNum(s.num)}</div>
              <input
                value={cont}
                onChange={e => setContent(s.cls, s.num, e.target.value)}
                onClick={e => e.stopPropagation()}
                placeholder="내용"
                style={{ width: '100%', boxSizing: 'border-box', border: 'none', background: 'transparent', fontSize: 12, color: SUB, padding: 0, marginTop: 3, minWidth: 0 }}
              />
            </>
          )}
          {s && s.canceled && perf && (
            <>
              <div style={ellip(14, 600)}>{s.cls}</div>
              <div style={{ marginTop: 5, fontSize: 14, fontWeight: 700, color: RED, letterSpacing: '-0.01em' }}>수행평가</div>
              {s.reason && s.reason !== '수행평가' && <div style={{ fontSize: 12, color: SUB, marginTop: 2, ...ellipBase }}>{s.reason}</div>}
            </>
          )}
          {s && s.canceled && !perf && (
            <>
              <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,transparent 0,transparent 5px,rgba(26,26,26,0.06) 5px,rgba(26,26,26,0.06) 6px)' }} />
              <div style={{ position: 'relative', ...ellip(14, 600), color: FAINT }}>{s.cls}</div>
              <div style={{ position: 'relative', fontSize: 12, color: SUB, marginTop: 4, ...ellipBase }}>{s.reason}</div>
            </>
          )}
          {popOpen && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', left: 6, top: 'calc(100% - 8px)', width: 208, background: '#FFFFFF',
                border: '1px solid ' + LINE, borderRadius: 6, boxShadow: '0 8px 24px rgba(26,26,26,0.12)',
                zIndex: 50, textAlign: 'left', cursor: 'default',
              }}
            >
              <div style={{ padding: '9px 14px', fontSize: 13, color: SUB, borderBottom: '1px solid ' + LINE_SOFT }}>
                {popTitle(pop.key, sessions)}
              </div>
              {pop.mode === 'menu' && (
                <>
                  {s && s.canceled ? (
                    <div className="hov2" onClick={() => clearCancel(key, perf ? '수행평가 표시를 해제했습니다.' : '결손을 해제했습니다.')} style={menuItem(true)}>
                      {perf ? '수행평가 해제' : '결손 해제'}
                    </div>
                  ) : (
                    <>
                      <div className="hov2" onClick={() => markCell(key, 'loss')} style={menuItem(true)}>결손 처리</div>
                      <div className="hov2" onClick={() => markCell(key, 'perf')} style={{ ...menuItem(false), color: RED, fontWeight: 600 }}>수행평가</div>
                    </>
                  )}
                  <div className="hov2" onClick={() => setPop({ ...pop, mode: 'edit' })} style={{ ...menuItem(false), paddingBottom: 11 }}>
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
        <div style={{ borderTop: '1px solid ' + LINE_SOFT, padding: '10px 0 0 12px', fontSize: 12, color: FAINT }}>{p}</div>
        {cells}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <DashStrip data={data} computed={computed} today={today} setUI={setUI} setWeekOffset={setWeekOffset} mon0={mon0} isMobile={isMobile} />

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, paddingBottom: 12, flexWrap: 'wrap' }}>
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

      <div ref={wrapRef} style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div style={{ width: showContents && !isMobile ? splitPct + '%' : '100%', minWidth: 0, flex: 'none' }}>
          <div className={isMobile ? 'table-scroll' : ''}>
            <div ref={gridRef} className={isMobile ? 'table-min' : ''} style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '38px repeat(5,minmax(0,1fr))' }}>
                <div style={{ background: '#F4F2ED' }} />
                {days.map(day => (
                  <div
                    key={day.iso}
                    style={{
                      padding: '10px 10px 8px', borderLeft: '1px solid ' + LINE_SOFT, fontSize: 13,
                      color: day.isToday ? GREEN : SUB, background: day.isToday ? '#EDF2F0' : '#F4F2ED',
                      ...ellipBase,
                    }}
                  >
                    <span style={{ borderBottom: '2px solid ' + (day.isToday ? GREEN : 'transparent'), paddingBottom: 3, fontWeight: 600 }}>{day.label}</span>
                  </div>
                ))}
                {rows}
              </div>
            </div>
          </div>
          {exam && toISO(fri) < exam.start && (
            <div style={{ marginTop: 20, borderTop: '1px solid ' + LINE, paddingTop: 8, fontSize: 12, color: FAINT }}>
              {exam.name} 이전 구간
            </div>
          )}
        </div>
        {showContents && !isMobile && (
          <div
            data-print="hide"
            onMouseDown={startDrag}
            title="드래그해서 너비 조절"
            style={{ width: 18, alignSelf: 'stretch', cursor: 'col-resize', display: 'flex', justifyContent: 'center', flex: 'none' }}
          >
            <div style={{ width: 3, borderRadius: 2, background: dragPct != null ? GREEN : '#DEDAD3' }} />
          </div>
        )}
        {showContents && !isMobile && (
          <div data-print="hide" style={{ flex: 1, minWidth: 0 }}>
            <ContentsPanel data={data} setData={setData} computed={computed} today={today} active={activeSubject} setActive={setActiveSubject} height={gridH} onCollapse={() => setUI({ contentsOpen: false })} />
          </div>
        )}
      </div>
      {showContents && isMobile && (
        <div data-print="hide" style={{ marginTop: 26 }}>
          <ContentsPanel data={data} setData={setData} computed={computed} today={today} active={activeSubject} setActive={setActiveSubject} onCollapse={() => setUI({ contentsOpen: false })} />
        </div>
      )}
    </div>
  )
}

// 대시보드: 한눈에 읽히는 게 목적이라 숫자를 키우고 라벨은 눌러 위계를 만든다.
function DashStrip({ data, computed, today, setUI, setWeekOffset, mon0, isMobile }) {
  const { sessions, perClass, exam } = computed
  const open = data.ui.dashOpen
  const todayD = fromISO(today)
  const dateLabel = todayD.getMonth() + 1 + '.' + todayD.getDate() + ' ' + DAYS[todayD.getDay()] + '요일'

  const todayRows = []
  for (let p = 1; p <= 7; p++) {
    const s = sessions[today + '|' + p]
    if (s) todayRows.push({ p, cls: s.cls, num: s.num, canceled: s.canceled, perf: s.perf, reason: s.reason })
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
  const chip = c => ({ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: colorOf(data, c), border: '1px solid rgba(26,26,26,0.16)', flex: 'none' })

  return (
    <div data-print="hide" style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: open ? 8 : 0 }}>
        <button
          onClick={() => setUI({ dashOpen: !open })}
          title={open ? '접기' : '펴기'}
          className="hov"
          style={{ border: 'none', background: 'none', padding: '3px 5px', borderRadius: 5, cursor: 'pointer', color: FAINT, display: 'flex', alignItems: 'center' }}
        >
          <Chevron open={open} />
        </button>
        {!open && <span style={{ fontSize: 12, color: FAINT }}>{dateLabel}</span>}
      </div>

      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
          {/* 오늘의 수업 */}
          <Tile label="오늘" sub={dateLabel}>
            {todayRows.length === 0 ? (
              <div style={{ fontSize: 15, fontWeight: 600, color: FAINT, paddingTop: 4 }}>수업 없음</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 2 }}>
                {todayRows.map(r => (
                  <div key={r.p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: FAINT, width: 30, flex: 'none' }}>{r.p}교시</span>
                    <span style={chip(r.cls)} />
                    <span style={{ fontSize: 14, fontWeight: 700, width: 34, flex: 'none' }}>{r.cls}</span>
                    {r.canceled ? (
                      <span style={{ fontSize: 13, fontWeight: 700, color: r.perf ? RED : FAINT }}>{r.perf ? '수행평가' : r.reason}</span>
                    ) : (
                      <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
                        {r.num}
                        <span style={{ fontSize: 12, fontWeight: 500, color: FAINT, marginLeft: 2 }}>차시</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Tile>

          {/* 반별 진도 */}
          <Tile label="진도" sub={data.classes.length + '개 반'}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 2 }}>
              {data.classes.length === 0 && <div style={{ fontSize: 13, color: FAINT }}>등록된 반이 없습니다</div>}
              {data.classes.map(c => {
                const cur = curOf(c)
                const total = sectionTarget(perClass[c], today)
                const behind = maxCur - cur
                return (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={chip(c)} />
                    <span style={{ fontSize: 14, fontWeight: 700, width: 34, flex: 'none' }}>{c}</span>
                    <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{cur}</span>
                    <span style={{ fontSize: 12, color: FAINT }}>/ {total}</span>
                    <div style={{ flex: 1 }} />
                    {behind > 0 && (
                      <button
                        onClick={() => goBehind(c)}
                        style={{
                          border: 'none', borderRadius: 4, padding: '3px 7px', cursor: 'pointer',
                          fontSize: 11, fontWeight: 700, color: '#FFFFFF', background: WARN, lineHeight: 1.2,
                        }}
                      >
                        −{behind}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </Tile>

          {/* 고사 */}
          <Tile label={exam ? exam.name : '고사'} sub={exam ? exam.start.slice(5).replace('-', '.') + ' 시작' : ''}>
            {exam ? (
              <div style={{ paddingTop: 2 }}>
                <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em' }}>
                  D-{dday}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 12px', marginTop: 10 }}>
                  {data.classes.map(c => (
                    <span key={c} style={{ fontSize: 12, color: SUB, whiteSpace: 'nowrap' }}>
                      {c} 남은 <b style={{ fontSize: 14, fontWeight: 700, color: INK }}>{(perClass[c] || []).filter(x => x.iso > today && x.iso < exam.start).length}</b>차시
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: FAINT, paddingTop: 4 }}>일정에 고사를 추가하면 남은 차시를 계산합니다</div>
            )}
          </Tile>
        </div>
      )}
    </div>
  )
}

function Tile({ label, sub, children }) {
  return (
    <div style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', padding: '12px 14px 14px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: SUB, letterSpacing: '0.04em' }}>{label}</span>
        {sub && <span style={{ fontSize: 11, color: FAINT }}>{sub}</span>}
      </div>
      {children}
    </div>
  )
}

function Chevron({ open }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 150ms' }}>
      <polyline points="5 9 12 16 19 9" />
    </svg>
  )
}

function popTitle(key, sessions) {
  const [iso, ps] = key.split('|')
  const s = sessions[key]
  if (!s) return ''
  const dd = fromISO(iso)
  return s.cls + ' · ' + DAYS[dd.getDay()] + ' ' + ps + '교시' + (s.num ? ' · ' + s.num + '차시' : '')
}

const ellipBase = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const ellip = (size, weight) => ({ fontSize: size, fontWeight: weight, lineHeight: 1.3, ...ellipBase })
const menuItem = first => ({ padding: first ? '9px 14px' : '9px 14px', fontSize: 14, cursor: 'pointer', fontWeight: first ? 600 : 400 })
const linkBtn = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: GREEN }
const navBtn = fs => ({ border: 'none', background: 'none', padding: fs === 15 ? '3px 9px' : '4px 9px', borderRadius: 6, cursor: 'pointer', fontSize: fs, lineHeight: 1 })
