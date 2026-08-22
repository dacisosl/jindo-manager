import React, { useEffect, useRef, useState } from 'react'
import introJs from 'intro.js'
import 'intro.js/introjs.css'
import { GREEN, INK, FAINT, LINE, SUB, SECTION_TITLE, CHIP_BTN, CHIP_BTN_OFF } from '../logic.js'
import TimetableEditor from './TimetableEditor.jsx'
import ScheduleEditor from './ScheduleEditor.jsx'
import ScheduleCalendar, { CalendarIcon, ListIcon } from './ScheduleCalendar.jsx'
import useWindowWidth from '../useWindowWidth.js'
import useSplit from '../useSplit.js'

// 최초 설정 = 진도표 화면과 같은 골격(윗줄 + 시간표 + 오른쪽 패널).
// 윗줄만 대시보드 대신 학기 기간이고, 오른쪽 패널은 차시별 내용 대신 일정이다.
export default function SetupView({ data, patch, setData, computed, setSnack, goImport, openSchools, onStart, fit, tourTick, holdTour }) {
  const { isMobile } = useWindowWidth()
  const { wrapRef, splitPct, dragging, startDrag } = useSplit(data, setData)
  const [mtab, setMtab] = useState('grid') // 모바일 탭: grid | sched
  const tourRef = useRef(null)

  const startTour = () => {
    if (tourRef.current) return
    const tour = introJs.tour()
    tourRef.current = tour
    tour
      .setOptions({
        nextLabel: '다음', prevLabel: '이전', doneLabel: '완료', skipLabel: '×',
        exitOnOverlayClick: true, showBullets: true, scrollToElement: true,
        steps: [
          { title: '학기 기간', element: '[data-intro-sem]', intro: '학기 시작일과 종료일을 정합니다. 이 기간의 평일에 차시가 계산됩니다.' },
          { title: '칸 선택', element: '[data-intro-grid]', intro: '수업이 있는 칸을 눌러 고릅니다. 한 반의 수업 시간을 모두 고르세요.' },
          { title: '반 등록', element: '[data-intro-register]', intro: '고른 칸을 반으로 등록합니다. 반 이름과 과목을 넣으면 색이 자동으로 부여됩니다.' },
          { title: '일정', element: '[data-intro-sched]', intro: '휴업일·행사·고사·출장을 넣으면 그 날 수업이 빠지고 뒤 차시가 밀립니다. [학교검색]을 누르면 우리 학교 학사일정을 그대로 가져올 수 있습니다.' },
          { title: '학교 시간표', element: '[data-intro-hamil]', intro: '해밀고 교사라면 이 마크를 눌러 이름 검색으로 시간표를 바로 불러올 수 있습니다.' },
          { title: '시작', element: '[data-intro-start]', intro: '다 채웠으면 이 버튼을 누릅니다. 진도표가 바로 만들어집니다.' },
        ],
      })
      .onbeforechange(function () {
        if (isMobile) setMtab((this._currentStep ?? 0) === 3 ? 'sched' : 'grid')
        return true
      })
      .onexit(() => {
        tourRef.current = null
        patch({ introSeen: true })
      })
    tour.start()
  }

  // 안내 투어는 모달이 떠 있는 동안 기다린다 — 학사일정 안내·학교 검색이 먼저다
  useEffect(() => {
    if (!data.introSeen && !holdTour) {
      const t = setTimeout(startTour, 400)
      return () => clearTimeout(t)
    }
  }, [holdTour])

  // 상단 바의 안내 버튼
  useEffect(() => {
    if (tourTick) startTour()
  }, [tourTick])

  const ok = data.semStart && data.semEnd && data.semStart < data.semEnd && Object.keys(data.pattern).length > 0
  const min = !!data.cfg.minimal

  const semFields = (
    <div data-intro-sem style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input type="date" value={data.semStart} onChange={e => patch({ semStart: e.target.value })} style={dateField} />
      <span style={{ fontSize: 13, color: FAINT }}>~</span>
      <input type="date" value={data.semEnd} onChange={e => patch({ semEnd: e.target.value })} style={dateField} />
    </div>
  )

  // 미니멀 데스크톱: 학기 날짜를 팔레트 줄 앞에 붙여 한 줄로 합친다
  const mergeSem = min && !isMobile
  const timetable = (
    <TimetableEditor
      data={data}
      setData={setData}
      setSnack={setSnack}
      cellHeight={fit ? 0 : 42}
      compact
      fill={fit}
      leading={mergeSem ? <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 'none' }}>{semFields}</div> : null}
    />
  )

  // 두 칼럼의 첫 줄(학기 / 일정)을 같은 높이로 맞춘다
  const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flex: 'none', height: 32, boxSizing: 'border-box' }

  const semRow = (
    <div style={rowStyle}>
      {!data.cfg.minimal && <div style={{ ...SECTION_TITLE, flex: 'none' }}>학기</div>}
      {semFields}
    </div>
  )

  // 일정 등록 방법. 처음에는 아무것도 펼치지 않고 두 버튼만 보여준다 —
  // 달력이나 목록이 먼저 보이면 어디부터 손대야 할지 알기 어렵기 때문.
  const schedView = data.cfg.schedView // null | 'cal' | 'list'
  const calView = schedView === 'cal'
  const setView = v => setData(d => ({ ...d, cfg: { ...d.cfg, schedView: v } }))

  // 등록 방법을 한 번 고른 뒤에는 달력뷰/일정뷰 탭으로 오간다
  const regButtons = (
    <div style={{ display: 'flex', gap: 6, flex: 'none', alignItems: 'center' }}>
      <button onClick={() => setView('cal')} title="달력에 칠해서 간편 등록" style={{ ...(calView ? CHIP_BTN : CHIP_BTN_OFF), padding: '7px 12px' }}>
        <CalendarIcon />
        달력뷰
      </button>
      <button onClick={() => setView('list')} title="이름·기간·유형을 직접 입력" style={{ ...(calView ? CHIP_BTN_OFF : CHIP_BTN), padding: '7px 12px' }}>
        <ListIcon />
        일정뷰
      </button>
      {/* 학교 이름으로 나이스 학사일정을 그대로 가져온다 — 하나씩 넣는 수고를 덜어준다 */}
      <button onClick={openSchools} title="학교 이름으로 학사일정 검색" style={{ ...CHIP_BTN_OFF, padding: '7px 12px' }}>
        <SearchIcon />
        학교검색
      </button>
    </div>
  )

  // 첫 화면 — 큰 버튼 두 개만. 일단 눌러보게 하는 것이 목적이다.
  const chooser = (
    <div style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }}>
      <div style={{ ...SECTION_TITLE, marginBottom: 4 }}>수업이 없는 날을 등록하세요</div>
      <button onClick={() => setView('cal')} style={bigBtn(true)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 800 }}>
          <CalendarIcon />간편등록(추천)
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 500, opacity: 0.85 }}>달력에서 쉬는 날을 죽 칠하면 끝</span>
      </button>
      <button onClick={() => setView('list')} style={bigBtn(false)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 800 }}>
          <ListIcon />세부등록
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: FAINT }}>이름·기간·유형을 하나씩 입력</span>
      </button>
      {/* 우리 학교 학사일정이 이미 나이스에 있다면 손으로 넣을 것도 없다 */}
      <button onClick={openSchools} style={{ ...linkish, marginTop: 2 }}>
        <SearchIcon />
        학교 이름으로 학사일정 찾기
      </button>
    </div>
  )

  const schedule = (
    <div data-intro-sched style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      {schedView == null ? chooser : calView ? (
        <ScheduleCalendar data={data} setData={setData} setSnack={setSnack} actions={regButtons} paintable />
      ) : (
        <div style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', padding: '0 12px 10px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <ScheduleEditor data={data} setData={setData} computed={computed} setSnack={setSnack} onImport={() => goImport('schedule')} onSchools={openSchools} actions={regButtons} fill />
        </div>
      )}
    </div>
  )

  // 모바일: 진도표 화면과 같은 탭 구조
  if (isMobile) {
    const tab = (id, text) => (
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
        {text}
      </button>
    )
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {semRow}
        <div style={{ display: 'flex', gap: 3, background: '#EFEDE8', borderRadius: 8, padding: 3, marginBottom: 10, flex: 'none' }}>
          {tab('grid', '시간표')}
          {tab('sched', '일정')}
        </div>
        {mtab === 'grid' ? timetable : <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{schedule}</div>}
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 1320, margin: '0 auto', height: fit ? '100%' : undefined, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div ref={wrapRef} style={{ display: 'flex', alignItems: 'stretch', flex: fit ? 1 : undefined, minHeight: fit ? 300 : 0 }}>
        <div style={{ width: splitPct + '%', minWidth: 0, flex: 'none', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!mergeSem && semRow}
          {timetable}
        </div>
        <div
          onMouseDown={startDrag}
          title="드래그해서 너비 조절"
          style={{ width: 18, alignSelf: 'stretch', cursor: 'col-resize', display: 'flex', justifyContent: 'center', flex: 'none' }}
        >
          <div style={{ width: 3, borderRadius: 2, background: dragging ? GREEN : '#DEDAD3' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {schedule}
        </div>
      </div>
    </div>
  )
}

const linkish = {
  display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none',
  padding: '4px 6px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: GREEN,
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  )
}

// 첫 화면의 큰 선택 버튼 (추천 쪽은 초록 채움)
const bigBtn = primary => ({
  width: '100%', maxWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
  border: '1px solid ' + (primary ? GREEN : LINE), borderRadius: 8,
  background: primary ? GREEN : '#FFFFFF', color: primary ? '#FFFFFF' : INK,
  padding: '15px 18px', cursor: 'pointer', lineHeight: 1.3,
})

const dateField = {
  border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF',
  fontSize: 13, padding: '6px 8px', boxSizing: 'border-box',
}
