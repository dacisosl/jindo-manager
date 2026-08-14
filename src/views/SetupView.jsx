import React, { useEffect, useRef, useState } from 'react'
import introJs from 'intro.js'
import 'intro.js/introjs.css'
import { GREEN, INK, FAINT, LINE, SUB } from '../logic.js'
import TimetableEditor from './TimetableEditor.jsx'
import ScheduleEditor from './ScheduleEditor.jsx'
import useWindowWidth from '../useWindowWidth.js'
import useSplit from '../useSplit.js'

// 최초 설정 = 진도표 화면과 같은 골격(위 스트립 + 시간표 + 오른쪽 패널).
// 위 스트립만 대시보드 대신 학기 기간이고, 오른쪽 패널은 차시별 내용 대신 일정이다.
export default function SetupView({ data, patch, setData, computed, setSnack, goImport, onStart, fit }) {
  const { isMobile } = useWindowWidth()
  const { wrapRef, splitPct, dragging, startDrag } = useSplit(data, setData)
  const [mtab, setMtab] = useState('grid') // 모바일 탭: grid | sem | sched
  const tourRef = useRef(null)

  const startTour = () => {
    if (tourRef.current) return
    const tour = introJs.tour()
    tourRef.current = tour
    const steps = [
      { title: '학기 기간', element: '[data-intro-sem]', intro: '학기 시작일과 종료일을 정합니다. 이 기간의 평일에 차시가 계산됩니다.' },
      { title: '칸 선택', element: '[data-intro-grid]', intro: '수업이 있는 칸을 눌러 고릅니다. 한 반의 수업 시간을 모두 고르세요.' },
      { title: '반 등록', element: '[data-intro-register]', intro: '고른 칸을 반으로 등록합니다. 반 이름과 과목을 넣으면 색이 자동으로 부여됩니다.' },
      { title: '일정', element: '[data-intro-sched]', intro: '휴업일·행사·고사·출장을 넣어두면 그 날 수업이 빠지고 뒤 차시가 밀립니다.' },
      { title: '학교 시간표', element: '[data-intro-hamil]', intro: '해밀고 교사라면 이 마크를 눌러 이름 검색으로 시간표를 바로 불러올 수 있습니다.' },
      { title: '시작', element: '[data-intro-start]', intro: '다 채웠으면 이 버튼을 누릅니다. 진도표가 바로 만들어집니다.' },
    ]
    tour
      .setOptions({
        nextLabel: '다음', prevLabel: '이전', doneLabel: '완료', skipLabel: '×',
        exitOnOverlayClick: true, showBullets: true, scrollToElement: true, steps,
      })
      .onbeforechange(function () {
        // 모바일은 탭이 나뉘어 있어 해당 단계의 탭을 먼저 연다
        if (!isMobile) return true
        const step = this._currentStep ?? 0
        const want = step === 0 ? 'sem' : step === 3 ? 'sched' : 'grid'
        setMtab(want)
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

  const ok = data.semStart && data.semEnd && data.semStart < data.semEnd && Object.keys(data.pattern).length > 0
  const label = { fontSize: 11, fontWeight: 700, color: SUB, letterSpacing: '0.04em', flex: 'none' }

  const semStrip = (
    <div data-intro-sem style={{ border: '1px solid ' + LINE, borderRadius: 8, background: '#FFFFFF', padding: '9px 12px 11px', flex: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={label}>학기 기간</span>
        <span style={{ fontSize: 11, color: FAINT }}>이 기간의 평일에 차시가 계산됩니다</span>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" value={data.semStart} onChange={e => patch({ semStart: e.target.value })} style={dateField} />
        <span style={{ fontSize: 13, color: FAINT }}>~</span>
        <input type="date" value={data.semEnd} onChange={e => patch({ semEnd: e.target.value })} style={dateField} />
      </div>
    </div>
  )

  const timetable = (
    <TimetableEditor data={data} setData={setData} cellHeight={fit ? 0 : 42} compact fill={fit} />
  )

  const schedule = (
    <div data-intro-sched style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, borderBottom: '1px solid ' + LINE, paddingBottom: 8, flex: 'none' }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>일정</span>
        <span style={{ fontSize: 11, color: FAINT }}>휴업일 · 고사 · 출장</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => goImport('schedule')} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, color: GREEN }}>
          파일에서
        </button>
      </div>
      <ScheduleEditor data={data} setData={setData} computed={computed} setSnack={setSnack} fill />
    </div>
  )

  const startButton = (
    <button
      data-intro-start
      onClick={() => ok && onStart()}
      style={{
        border: 'none', borderRadius: 6, padding: isMobile ? '11px 0' : '9px 24px', width: isMobile ? '100%' : undefined,
        fontSize: 15, fontWeight: 700, background: ok ? GREEN : LINE, color: '#FFFFFF', cursor: ok ? 'pointer' : 'default',
      }}
    >
      {data.setupDone ? '완료' : '시작'}
    </button>
  )

  const header = (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, paddingBottom: 10, flex: 'none' }}>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{data.setupDone ? '수정' : '시작하기'}</div>
      {!isMobile && (
        <div style={{ fontSize: 12, color: FAINT }}>
          {data.setupDone ? '학기 기간 · 시간표 · 일정을 고칠 수 있습니다.' : '학기 기간과 시간표를 채우면 진도표가 만들어집니다.'}
        </div>
      )}
      <div style={{ flex: 1 }} />
      <button onClick={() => goImport('timetable')} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: GREEN }}>
        파일에서 가져오기
      </button>
      <button onClick={startTour} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: SUB }}>
        안내
      </button>
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
        {header}
        <div style={{ display: 'flex', gap: 3, background: '#EFEDE8', borderRadius: 8, padding: 3, marginBottom: 10, flex: 'none' }}>
          {tab('grid', '시간표')}
          {tab('sem', '학기')}
          {tab('sched', '일정')}
        </div>

        {mtab === 'grid' && <>{timetable}</>}
        {mtab === 'sem' && <div style={{ flex: 1, minHeight: 0 }}>{semStrip}</div>}
        {mtab === 'sched' && <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{schedule}</div>}

        <div style={{ paddingTop: 10, flex: 'none' }}>
          {startButton}
          {!ok && <div style={{ marginTop: 6, fontSize: 11, color: FAINT, textAlign: 'center' }}>학기 기간과 시간표를 채우면 시작할 수 있습니다.</div>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 1320, margin: '0 auto', height: fit ? '100%' : undefined, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {header}
      <div style={{ marginBottom: 12, flex: 'none' }}>{semStrip}</div>

      <div ref={wrapRef} style={{ display: 'flex', alignItems: 'stretch', flex: fit ? 1 : undefined, minHeight: fit ? 300 : 0 }}>
        <div style={{ width: splitPct + '%', minWidth: 0, flex: 'none', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 12, flex: 'none' }}>
        {startButton}
        {!ok && <div style={{ fontSize: 12, color: FAINT }}>학기 기간과 시간표를 채우면 시작할 수 있습니다.</div>}
      </div>
    </div>
  )
}

const dateField = {
  border: '1px solid ' + LINE, borderRadius: 6, background: '#FFFFFF',
  fontSize: 14, padding: '7px 9px', boxSizing: 'border-box',
}
