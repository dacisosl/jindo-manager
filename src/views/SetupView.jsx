import React, { useEffect, useRef } from 'react'
import introJs from 'intro.js'
import 'intro.js/introjs.css'
import { GREEN, FAINT, LINE, SUB } from '../logic.js'
import TimetableEditor from './TimetableEditor.jsx'
import useWindowWidth from '../useWindowWidth.js'

// 최초 설정: 학기 기간과 시간표를 한 화면에서 끝낸다.
export default function SetupView({ data, patch, setData, onStart }) {
  const { isMobile } = useWindowWidth()
  const tourRef = useRef(null)

  const startTour = () => {
    if (tourRef.current) return
    const tour = introJs.tour()
    tourRef.current = tour
    tour
      .setOptions({
        nextLabel: '다음',
        prevLabel: '이전',
        doneLabel: '완료',
        skipLabel: '×',
        exitOnOverlayClick: true,
        showBullets: true,
        scrollToElement: true,
        steps: [
          { title: '학기 기간', element: '[data-intro-sem]', intro: '학기 시작일과 종료일을 입력합니다. 이 기간의 평일에 차시가 계산됩니다.' },
          { title: '칸 선택', element: '[data-intro-grid]', intro: '수업이 있는 칸을 눌러 선택합니다. 한 반의 수업 시간을 모두 선택하세요.' },
          { title: '반 등록', element: '[data-intro-register]', intro: '선택한 칸을 반으로 등록합니다. 반 이름과 과목을 넣으면 색이 자동으로 부여됩니다.' },
          { title: '색·칠하기', element: '[data-intro-palette]', intro: '등록된 반을 고른 뒤 드래그로 칠할 수도 있습니다. 색 사각형을 누르면 색과 과목을 바꿉니다.' },
          { title: '학교 데이터', element: '[data-intro-hamil]', intro: '해밀고 교사라면 이 마크를 눌러 이름 검색으로 기존 시간표를 바로 불러올 수 있습니다.' },
          { title: '시작', element: '[data-intro-start]', intro: '시간표를 다 채웠으면 시작을 누릅니다. 진도표가 바로 만들어집니다.' },
        ],
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

  return (
    <div style={{ maxWidth: 720, margin: (isMobile ? 20 : 40) + 'px auto 0' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>시작하기</div>
        <div style={{ flex: 1 }} />
        <button onClick={startTour} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: GREEN }}>
          안내 보기
        </button>
      </div>

      <div data-intro-sem style={{ display: 'flex', gap: isMobile ? 16 : 26, marginTop: 26, maxWidth: 420 }}>
        <label style={{ flex: 1, fontSize: 12, color: SUB }}>
          학기 시작일
          <input type="date" value={data.semStart} onChange={e => patch({ semStart: e.target.value })} style={dateInput} />
        </label>
        <label style={{ flex: 1, fontSize: 12, color: SUB }}>
          학기 종료일
          <input type="date" value={data.semEnd} onChange={e => patch({ semEnd: e.target.value })} style={dateInput} />
        </label>
      </div>

      <div style={{ fontSize: 13, color: SUB, margin: '30px 0 12px' }}>
        수업이 있는 칸을 선택하고 <b style={{ fontWeight: 600 }}>반 등록</b>을 누르세요.
      </div>
      <TimetableEditor data={data} setData={setData} cellHeight={44} compact />

      <div style={{ display: 'flex', marginTop: 32, paddingBottom: 40 }}>
        <button
          data-intro-start
          onClick={() => ok && onStart()}
          style={{
            border: 'none', borderRadius: 6, padding: '9px 22px', fontSize: 15, fontWeight: 600,
            background: ok ? GREEN : LINE, color: '#FFFFFF', cursor: ok ? 'pointer' : 'default',
          }}
        >
          시작
        </button>
        {!ok && <div style={{ alignSelf: 'center', marginLeft: 14, fontSize: 12, color: FAINT }}>기간과 시간표를 채우면 시작할 수 있습니다.</div>}
      </div>
    </div>
  )
}

const dateInput = {
  display: 'block', width: '100%', boxSizing: 'border-box', border: 'none',
  borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 15, padding: '7px 0', marginTop: 6,
}
