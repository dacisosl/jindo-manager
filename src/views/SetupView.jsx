import React, { useEffect, useRef, useState } from 'react'
import introJs from 'intro.js'
import 'intro.js/introjs.css'
import { GREEN, INK, FAINT, LINE, SUB, SECTION_TITLE } from '../logic.js'
import TimetableEditor from './TimetableEditor.jsx'
import ScheduleEditor from './ScheduleEditor.jsx'
import useWindowWidth from '../useWindowWidth.js'
import useSplit from '../useSplit.js'

// 최초 설정 = 진도표 화면과 같은 골격(윗줄 + 시간표 + 오른쪽 패널).
// 윗줄만 대시보드 대신 학기 기간이고, 오른쪽 패널은 차시별 내용 대신 일정이다.
export default function SetupView({ data, patch, setData, computed, setSnack, goImport, onStart, fit, tourTick }) {
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
          { title: '일정', element: '[data-intro-sched]', intro: '휴업일·행사·고사·출장을 넣으면 그 날 수업이 빠지고 뒤 차시가 밀립니다.' },
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

  useEffect(() => {
    if (!data.introSeen) {
      const t = setTimeout(startTour, 400)
      return () => clearTimeout(t)
    }
  }, [])

  // 상단 바의 안내 버튼
  useEffect(() => {
    if (tourTick) startTour()
  }, [tourTick])

  const ok = data.semStart && data.semEnd && data.semStart < data.semEnd && Object.keys(data.pattern).length > 0

  const semFields = (
    <div data-intro-sem style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <input type="date" value={data.semStart} onChange={e => patch({ semStart: e.target.value })} style={dateField} />
      <span style={{ fontSize: 13, color: FAINT }}>~</span>
      <input type="date" value={data.semEnd} onChange={e => patch({ semEnd: e.target.value })} style={dateField} />
    </div>
  )

  const timetable = <TimetableEditor data={data} setData={setData} cellHeight={fit ? 0 : 42} compact fill={fit} />

  // 두 칼럼의 첫 줄(학기 / 일정)을 같은 높이로 맞춘다
  const rowStyle = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flex: 'none', height: 32, boxSizing: 'border-box' }

  const semRow = (
    <div style={rowStyle}>
      <div style={{ ...SECTION_TITLE, flex: 'none' }}>학기</div>
      {semFields}
    </div>
  )

  const schedule = (
    <div data-intro-sched style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div style={rowStyle}>
        <span style={SECTION_TITLE}>일정</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => goImport('schedule')} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: GREEN }}>
          파일에서
        </button>
      </div>
      <div style={{ border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF', padding: '0 12px 10px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ScheduleEditor data={data} setData={setData} computed={computed} setSnack={setSnack} fill />
      </div>
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
          {semRow}
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

const dateField = {
  border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF',
  fontSize: 13, padding: '6px 8px', boxSizing: 'border-box',
}
