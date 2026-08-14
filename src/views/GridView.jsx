import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DAYS, GREEN, INK, SUB, FAINT, LINE, LINE_SOFT, WARN, RED, addDays, fromISO, toISO, colorOf, subjectOf, sectionTarget } from '../logic.js'
import ContentsPanel from './ContentsPanel.jsx'
import useWindowWidth from '../useWindowWidth.js'

export default function GridView({ data, setData, computed, today, setSnack, go, goImport, weekOffset, setWeekOffset, stagger, fit }) {
  const { sessions, perClass, exam } = computed
  const cfg = data.cfg
  const { isMobile } = useWindowWidth()
  const [pop, setPop] = useState(null) // {key, mode:'menu'|'edit', draft}
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSubject, setActiveSubject] = useState(data.subjects[0] || '수학')
  const [mtab, setMtab] = useState('grid') // 모바일 탭: grid | dash | contents
  const [printOpen, setPrintOpen] = useState(false)
  const [printRemember, setPrintRemember] = useState(true)
  const [dragPct, setDragPct] = useState(null)
  const [gridH, setGridH] = useState(null)
  const wrapRef = useRef(null)
  const gridRef = useRef(null)

  useEffect(() => {
    const close = () => {
      setPop(null)
      setMenuOpen(false)
      setPrintOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  // 한 화면 모드에서는 표가 남은 높이를 채우므로 패널도 100%로 맞추면 된다.
  // 그 외에는 표 높이를 재서 패널에 넘겨준다.
  useLayoutEffect(() => {
    if (!gridRef.current || isMobile || fit) {
      setGridH(null)
      return
    }
    const measure = () => gridRef.current && setGridH(gridRef.current.getBoundingClientRect().height)
    measure() // ResizeObserver는 비동기라 첫 값은 직접 잰다
    const ro = new ResizeObserver(measure)
    ro.observe(gridRef.current)
    return () => ro.disconnect()
  }, [isMobile, fit])

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
  const semM = semD.getMonth() + 1
  const semLabel = semD.getFullYear() + '-' + (semM >= 3 && semM <= 7 ? '1' : '2') + '학기'

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
          display: 'inline-block', fontSize: isMobile ? 15 : 19, fontWeight: 700, lineHeight: 1.1,
          animation: cfg.anim ? 'numSlide 200ms ease both' : 'none',
          animationDelay: stagger ? i * 40 + 'ms' : '0ms',
        }}
      >
        {num}
      </span>
    )
  }

  // 이번 주에 해당하는 차시 번호 — 차시별 내용 패널을 이 위치로 스크롤한다.
  const weekNums = []
  days.forEach(day => {
    for (let p = 1; p <= 7; p++) {
      const s = sessions[day.iso + '|' + p]
      if (s && !s.canceled && subjectOf(data, s.cls) === activeSubject) weekNums.push(s.num)
    }
  })
  const focusNum = weekNums.length ? Math.round(weekNums.reduce((a, b) => a + b, 0) / weekNums.length) : null

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
            position: 'relative', minHeight: fit ? 0 : 58, padding: isMobile ? '4px 4px' : '7px 9px',
            boxSizing: 'border-box', minWidth: 0, overflow: 'hidden',
            borderTop: '1px solid ' + LINE_SOFT, borderLeft: '1px solid ' + LINE_SOFT,
            cursor: clickable ? 'pointer' : 'default',
            boxShadow: day.isToday ? 'inset 1px 0 0 rgba(15,92,77,0.4), inset -1px 0 0 rgba(15,92,77,0.4)' : 'none',
            background: s && (!s.canceled || perf) ? colorOf(data, s.cls) : '#FFFFFF',
          }}
        >
          {s && !s.canceled && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: isMobile ? 3 : 6, minWidth: 0, justifyContent: isMobile ? 'center' : 'flex-start' }}>
                <span style={{ ...ellip(isMobile ? 11 : 13, 600), flex: 'none' }}>{s.cls}</span>
                {mkNum(s.num)}
              </div>
              {!isMobile && (
                <input
                  value={cont}
                  onChange={e => setContent(s.cls, s.num, e.target.value)}
                  onClick={e => e.stopPropagation()}
                  placeholder="내용"
                  style={{ width: '100%', boxSizing: 'border-box', border: 'none', background: 'transparent', fontSize: 12, color: SUB, padding: 0, marginTop: 2, minWidth: 0 }}
                />
              )}
            </>
          )}
          {s && s.canceled && perf && (
            <>
              <div style={{ ...ellip(isMobile ? 11 : 13, 600), textAlign: isMobile ? 'center' : 'left' }}>{s.cls}</div>
              <div style={{ marginTop: 2, fontSize: isMobile ? 10 : 13, fontWeight: 700, color: RED, letterSpacing: '-0.01em', textAlign: isMobile ? 'center' : 'left', ...ellipBase }}>수행평가</div>
            </>
          )}
          {s && s.canceled && !perf && (
            <>
              <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,transparent 0,transparent 5px,rgba(26,26,26,0.06) 5px,rgba(26,26,26,0.06) 6px)' }} />
              <div style={{ position: 'relative', ...ellip(isMobile ? 11 : 13, 600), color: FAINT, textAlign: isMobile ? 'center' : 'left' }}>{s.cls}</div>
              <div style={{ position: 'relative', fontSize: isMobile ? 10 : 12, color: SUB, marginTop: 2, textAlign: isMobile ? 'center' : 'left', ...ellipBase }}>{s.reason}</div>
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
        <div style={{ borderTop: '1px solid ' + LINE_SOFT, padding: isMobile ? '6px 0 0 0' : '8px 0 0 10px', fontSize: isMobile ? 10 : 12, color: FAINT, textAlign: isMobile ? 'center' : 'left' }}>{p}</div>
        {cells}
      </div>
    )
  }

  const doPrint = scale => {
    if (printRemember) setData(d => ({ ...d, cfg: { ...d.cfg, printScale: scale } }))
    document.body.dataset.printScale = scale
    setPrintOpen(false)
    setTimeout(() => window.print(), 120)
  }

  const printButton = (
    <div data-print="hide" style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={e => { e.stopPropagation(); setPrintOpen(!printOpen); setPop(null); setMenuOpen(false) }}
        className="hov"
        style={{
          display: 'flex', alignItems: 'center', gap: 5, border: '1px solid ' + LINE, borderRadius: 6,
          background: '#FFFFFF', color: SUB, padding: '5px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 600, lineHeight: 1,
        }}
      >
        <PrinterIcon />
        인쇄
      </button>
      {printOpen && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', left: 0, top: 34, width: 208, background: '#FFFFFF', border: '1px solid ' + LINE,
            borderRadius: 6, boxShadow: '0 8px 24px rgba(26,26,26,0.12)', padding: '6px 0', zIndex: 60,
          }}
        >
          {[['s', '작게', 'A4의 1/4'], ['m', '중간', 'A4의 1/2'], ['l', '크게', 'A4 한 장']].map(([k, label, note]) => (
            <div
              key={k}
              className="hov2"
              onClick={() => doPrint(k)}
              style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '8px 14px', fontSize: 14, cursor: 'pointer' }}
            >
              <span style={{ fontWeight: cfg.printScale === k ? 700 : 400 }}>{label}</span>
              <span style={{ fontSize: 11, color: FAINT }}>{note}</span>
              <div style={{ flex: 1 }} />
              {cfg.printScale === k && <span style={{ fontSize: 12, color: GREEN, fontWeight: 700 }}>✓</span>}
            </div>
          ))}
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px 8px', marginTop: 4, borderTop: '1px solid ' + LINE_SOFT, fontSize: 12, color: SUB, cursor: 'pointer' }}
          >
            <input type="checkbox" checked={printRemember} onChange={e => setPrintRemember(e.target.checked)} style={{ accentColor: GREEN, margin: 0 }} />
            이 기준 기억하기
          </label>
        </div>
      )}
    </div>
  )

  const toolbar = (
    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, paddingBottom: 8, flex: 'none' }}>
      {!isMobile && <div style={{ fontSize: 15, fontWeight: 600 }}>{semLabel}</div>}
      {printButton}
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
              <div className="hov2" onClick={() => { setMenuOpen(false); goImport('timetable') }} style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>파일에서 가져오기</div>
              <div className="hov2" onClick={() => { setMenuOpen(false); go('setup') }} style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>학기·시간표·일정 수정</div>
            </div>
          )}
        </div>
        {!isMobile && (
          <button
            onClick={() => setUI({ contentsOpen: !showContents })}
            title={showContents ? '차시별 내용 접기' : '차시별 내용 펴기'}
            className={showContents ? '' : 'hov'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, marginLeft: 6,
              border: '1px solid ' + (showContents ? GREEN : LINE), borderRadius: 6,
              background: showContents ? GREEN : '#FFFFFF', color: showContents ? '#FFFFFF' : SUB,
              padding: '5px 9px 5px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap',
            }}
          >
            <PanelIcon open={showContents} />
            차시별 내용
          </button>
        )}
      </div>
    </div>
  )

  const table = (
    <div
      ref={gridRef}
      style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', overflow: 'hidden', height: fit ? '100%' : undefined }}
    >
      <div
        style={{
          display: 'grid', gridTemplateColumns: (isMobile ? '22px' : '34px') + ' repeat(5,minmax(0,1fr))',
          gridTemplateRows: fit ? 'auto repeat(7, minmax(0,1fr))' : undefined, height: fit ? '100%' : undefined,
        }}
      >
        <div style={{ background: '#F4F2ED' }} />
        {days.map(day => (
          <div
            key={day.iso}
            style={{
              padding: isMobile ? '6px 4px 5px' : '8px 10px 7px', borderLeft: '1px solid ' + LINE_SOFT,
              fontSize: isMobile ? 11 : 13, textAlign: isMobile ? 'center' : 'left',
              color: day.isToday ? GREEN : SUB, background: day.isToday ? '#E7EFEC' : '#F4F2ED',
              ...ellipBase,
            }}
          >
            <span style={{ borderBottom: '2px solid ' + (day.isToday ? GREEN : 'transparent'), paddingBottom: 2, fontWeight: 700 }}>{day.label}</span>
          </div>
        ))}
        {rows}
      </div>
    </div>
  )

  // 모바일: 진도표 · 대시보드 · 차시별 내용을 탭으로 나눠 각각 한 화면에 담는다.
  if (isMobile) {
    const tab = (id, label) => (
      <button
        key={id}
        onClick={() => setMtab(id)}
        style={{
          flex: 1, border: 'none', background: mtab === id ? '#FFFFFF' : 'transparent',
          borderRadius: 6, padding: '7px 0', cursor: 'pointer',
          fontSize: 13, fontWeight: mtab === id ? 700 : 500, color: mtab === id ? INK : SUB,
          boxShadow: mtab === id ? '0 1px 3px rgba(26,26,26,0.10)' : 'none',
        }}
      >
        {label}
      </button>
    )
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div data-print="hide" style={{ display: 'flex', gap: 3, background: '#EFEDE8', borderRadius: 8, padding: 3, marginBottom: 10, flex: 'none' }}>
          {tab('grid', '진도표')}
          {tab('dash', '대시보드')}
          {tab('contents', '차시별 내용')}
        </div>

        {mtab === 'grid' && (
          <>
            {toolbar}
            <div style={{ flex: 1, minHeight: 0 }}>{table}</div>
          </>
        )}
        {mtab === 'dash' && (
          <div className="soft-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <DashStrip data={data} computed={computed} today={today} setUI={setUI} setWeekOffset={setWeekOffset} mon0={mon0} isMobile alwaysOpen />
          </div>
        )}
        {mtab === 'contents' && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <ContentsPanel data={data} setData={setData} computed={computed} today={today} active={activeSubject} setActive={setActiveSubject} height="100%" focusNum={focusNum} weekNums={weekNums} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 1320, margin: '0 auto', height: fit ? '100%' : undefined, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <DashStrip data={data} computed={computed} today={today} setUI={setUI} setWeekOffset={setWeekOffset} mon0={mon0} isMobile={isMobile} />
      {toolbar}

      <div ref={wrapRef} style={{ display: 'flex', alignItems: fit ? 'stretch' : 'flex-start', flex: fit ? 1 : undefined, minHeight: fit ? 300 : 0 }}>
        <div style={{ width: showContents ? splitPct + '%' : '100%', minWidth: 0, flex: 'none', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ flex: fit ? 1 : undefined, minHeight: 0 }}>{table}</div>
          {exam && toISO(fri) < exam.start && !fit && (
            <div style={{ marginTop: 20, borderTop: '1px solid ' + LINE, paddingTop: 8, fontSize: 12, color: FAINT }}>
              {exam.name} 이전 구간
            </div>
          )}
        </div>
        {showContents && (
          <div
            data-print="hide"
            onMouseDown={startDrag}
            title="드래그해서 너비 조절"
            style={{ width: 18, alignSelf: 'stretch', cursor: 'col-resize', display: 'flex', justifyContent: 'center', flex: 'none' }}
          >
            <div style={{ width: 3, borderRadius: 2, background: dragPct != null ? GREEN : '#DEDAD3' }} />
          </div>
        )}
        {showContents && (
          <div data-print="hide" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <ContentsPanel data={data} setData={setData} computed={computed} today={today} active={activeSubject} setActive={setActiveSubject} height={fit ? '100%' : gridH} focusNum={focusNum} weekNums={weekNums} onCollapse={() => setUI({ contentsOpen: false })} />
          </div>
        )}
      </div>
    </div>
  )
}

// 대시보드: 한눈에 읽히는 게 목적이라 숫자를 키우고 라벨은 눌러 위계를 만든다.
function DashStrip({ data, computed, today, setUI, setWeekOffset, mon0, isMobile, alwaysOpen }) {
  const { sessions, perClass, exam } = computed
  const open = alwaysOpen || data.ui.dashOpen
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
  const show = data.cfg.dash
  const tileCount = (show.today ? 1 : 0) + (show.progress ? 1 : 0) + (show.exam ? 1 : 0)
  // 한 줄에 다 늘어놓으면 읽기 어려우니 3개씩 끊어 배열한다.
  const cols3 = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '6px 10px' }

  return (
    <div data-print="hide" style={{ marginBottom: 12, flex: 'none' }}>
      {!alwaysOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: open ? 7 : 0 }}>
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
      )}

      {open && tileCount > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(' + tileCount + ', minmax(0,1fr))', gap: 10 }}>
          {/* 오늘의 수업 */}
          {show.today && (
            <Tile label="오늘" sub={dateLabel}>
              {todayRows.length === 0 ? (
                <div style={{ fontSize: 14, fontWeight: 600, color: FAINT }}>수업 없음</div>
              ) : (
                <div style={cols3}>
                  {todayRows.map(r => (
                    <div key={r.p} style={{ display: 'flex', alignItems: 'baseline', gap: 5, minWidth: 0 }}>
                      <span style={{ fontSize: 11, color: FAINT, flex: 'none' }}>{r.p}교시</span>
                      <span style={{ ...chip(r.cls), alignSelf: 'center' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, flex: 'none' }}>{r.cls}</span>
                      {r.canceled ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: r.perf ? RED : FAINT, ...ellipBase }}>{r.perf ? '수행' : r.reason}</span>
                      ) : (
                        <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{r.num}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Tile>
          )}

          {/* 반별 진도 */}
          {show.progress && (
            <Tile label="진도" sub={data.classes.length + '개 반'}>
              {data.classes.length === 0 ? (
                <div style={{ fontSize: 13, color: FAINT }}>등록된 반이 없습니다</div>
              ) : (
                <div style={cols3}>
                  {data.classes.map(c => {
                    const cur = curOf(c)
                    const total = sectionTarget(perClass[c], today)
                    const behind = maxCur - cur
                    return (
                      <div key={c} style={{ display: 'flex', alignItems: 'baseline', gap: 5, minWidth: 0 }}>
                        <span style={{ ...chip(c), alignSelf: 'center' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, flex: 'none' }}>{c}</span>
                        <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{cur}</span>
                        <span style={{ fontSize: 11, color: FAINT }}>/{total}</span>
                        {behind > 0 && (
                          <button
                            onClick={() => goBehind(c)}
                            title={'가장 빠른 반보다 ' + behind + '차시 뒤처짐'}
                            style={{
                              border: 'none', borderRadius: 3, padding: '2px 5px', cursor: 'pointer',
                              fontSize: 10, fontWeight: 700, color: '#FFFFFF', background: WARN, lineHeight: 1.2, flex: 'none',
                            }}
                          >
                            −{behind}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </Tile>
          )}

          {/* 고사 */}
          {show.exam && (
            <Tile label={exam ? exam.name : '고사'} sub={exam ? exam.start.slice(5).replace('-', '.') + ' 시작' : ''}>
              {exam ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', flex: 'none' }}>
                    D-{dday}
                  </div>
                  <div style={{ ...cols3, flex: 1, minWidth: 0 }}>
                    {data.classes.map(c => (
                      <span key={c} style={{ fontSize: 11, color: SUB, whiteSpace: 'nowrap' }}>
                        {c} <b style={{ fontSize: 13, fontWeight: 700, color: INK }}>{(perClass[c] || []).filter(x => x.iso > today && x.iso < exam.start).length}</b>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: FAINT }}>일정에 고사를 추가하면 남은 차시를 계산합니다</div>
              )}
            </Tile>
          )}
        </div>
      )}
    </div>
  )
}

function Tile({ label, sub, children }) {
  return (
    <div style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', padding: '9px 12px 11px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: SUB, letterSpacing: '0.04em' }}>{label}</span>
        {sub && <span style={{ fontSize: 11, color: FAINT }}>{sub}</span>}
      </div>
      {children}
    </div>
  )
}

function PrinterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 3 18 3 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  )
}

// 오른쪽 패널이 열렸는지 닫혔는지 한눈에 보이는 아이콘
function PanelIcon({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="14" y1="4" x2="14" y2="20" />
      {open ? <polyline points="19 9 16.5 12 19 15" /> : <polyline points="16 9 18.5 12 16 15" />}
    </svg>
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
