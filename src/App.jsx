import React, { useEffect, useMemo, useRef, useState } from 'react'
import { loadData, saveData } from './storage.js'
import { compute, toISO, GREEN, SUB } from './logic.js'
import GridView from './views/GridView.jsx'
import ImportView from './views/ImportView.jsx'
import SettingsModal from './views/SettingsModal.jsx'
import HamilModal from './views/HamilModal.jsx'
import SetupView from './views/SetupView.jsx'
import Snackbar from './views/Snackbar.jsx'
import useWindowWidth from './useWindowWidth.js'

export default function App() {
  const [data, setData] = useState(loadData)
  useEffect(() => saveData(data), [data])
  // 인쇄 배율은 CSS가 body 속성을 보고 정한다
  useEffect(() => {
    document.body.dataset.printScale = data.cfg.printScale || 'l'
  }, [data.cfg.printScale])

  const { isMobile } = useWindowWidth()
  const [view, setView] = useState(() => (loadData().setupDone ? 'grid' : 'setup'))
  const [weekOffset, setWeekOffset] = useState(0)
  const [importKind, setImportKind] = useState('timetable')
  const [stagger, setStagger] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [hamilOpen, setHamilOpen] = useState(false)
  const [snack, setSnackState] = useState(null)
  const snackT = useRef()

  const today = toISO(new Date())
  const computed = useMemo(() => compute(data), [data])

  const patch = p => setData(d => ({ ...d, ...p }))
  const setSnack = sn => {
    clearTimeout(snackT.current)
    if (sn) snackT.current = setTimeout(() => setSnackState(null), 9000)
    setSnackState(sn)
  }

  const go = v => setView(v)
  const goImport = kind => {
    setImportKind(kind)
    setView('import')
  }

  const ctx = { data, patch, setData, computed, today, snack, setSnack, go, goImport, weekOffset, setWeekOffset, stagger }

  const finishSetup = () => {
    patch({ setupDone: true })
    setWeekOffset(0)
    setStagger(true)
    setView('grid')
    setTimeout(() => setStagger(false), 1600)
  }

  // 진도표와 최초 설정은 데스크톱·모바일 모두 한 화면에 담는다(모바일은 탭으로 나뉜다).
  // 나머지 화면은 자연스럽게 스크롤한다.
  const fit = view === 'grid' || view === 'setup'

  return (
    <div
      style={{
        height: fit ? '100vh' : undefined,
        minHeight: fit ? undefined : '100vh',
        overflow: fit ? 'hidden' : undefined,
        display: 'flex', flexDirection: 'column',
        padding: isMobile ? '14px 14px 80px' : fit ? '16px 32px 18px' : '22px 40px 90px',
        boxSizing: 'border-box',
      }}
    >
      <div
        data-print="hide"
        style={{
          width: '100%', maxWidth: 1320, margin: '0 auto ' + (isMobile ? 14 : fit ? 12 : 22) + 'px',
          display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #C9C5BE',
          paddingBottom: fit ? 9 : 12, flex: 'none', boxSizing: 'border-box',
        }}
      >
        <div
          onClick={() => data.setupDone && go('grid')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: isMobile ? 20 : 23, fontWeight: 800, letterSpacing: '-0.035em',
            cursor: data.setupDone ? 'pointer' : 'default',
          }}
        >
          <span style={{ display: 'inline-block', width: 6, height: isMobile ? 19 : 22, borderRadius: 2, background: GREEN, flex: 'none' }} />
          진도계획표
        </div>
        <div style={{ flex: 1 }} />
        {view === 'setup' ? (
          <button
            data-intro-hamil
            onClick={() => setHamilOpen(true)}
            title="해밀고 데이터 불러오기"
            className="hov"
            style={{ border: 'none', background: 'none', borderRadius: 6, padding: 3, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <HamilMark />
          </button>
        ) : (
          <button
            onClick={() => go('setup')}
            title="학기·시간표·일정 수정"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              border: '1px solid ' + GREEN, borderRadius: 999, background: '#FFFFFF', color: GREEN,
              padding: '5px 13px 5px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 700, lineHeight: 1,
            }}
          >
            <PencilIcon />
            수정
          </button>
        )}
        <button
          onClick={() => setSettingsOpen(true)}
          title="설정"
          className="hov"
          style={{ border: 'none', background: 'none', padding: 5, borderRadius: 6, cursor: 'pointer', display: 'flex', color: SUB }}
        >
          <GearIcon />
        </button>
      </div>

      <div style={{ flex: fit ? 1 : undefined, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: fit ? 'auto' : undefined }}>
        {view === 'grid' && <GridView {...ctx} fit={fit} />}
        {view === 'import' && <ImportView {...ctx} kind={importKind} />}
        {view === 'setup' && <SetupView {...ctx} fit={fit} onStart={finishSetup} />}
      </div>

      {settingsOpen && (
        <SettingsModal
          data={data}
          setData={setData}
          computed={computed}
          today={today}
          setSnack={setSnack}
          onClose={() => setSettingsOpen(false)}
          onResetSetup={() => go('setup')}
        />
      )}
      {hamilOpen && (
        <HamilModal
          data={data}
          setData={setData}
          setSnack={sn => { setSnack(sn); if (view === 'setup') setView('grid') }}
          onClose={() => setHamilOpen(false)}
        />
      )}

      <Snackbar snack={snack} setSnack={setSnack} data={data} setData={setData} />
    </div>
  )
}

// 학교 로고: public/haemil.png 가 있으면 그 이미지를, 없으면 글자 배지를 쓴다.
function HamilMark() {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span style={{ display: 'inline-block', borderRadius: 5, background: GREEN, color: '#FFFFFF', fontSize: 12, fontWeight: 700, padding: '5px 9px', lineHeight: 1 }}>
        해밀
      </span>
    )
  }
  return (
    <img
      src={import.meta.env.BASE_URL + 'haemil.png'}
      alt="해밀고등학교"
      onError={() => setFailed(true)}
      style={{ height: 28, width: 'auto', display: 'block' }}
    />
  )
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.47V21a2 2 0 1 1-4 0v-.09a1.6 1.6 0 0 0-1.05-1.47 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-.97H3a2 2 0 1 1 0-4h.09a1.6 1.6 0 0 0 1.47-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32h.09a1.6 1.6 0 0 0 .97-1.47V3a2 2 0 1 1 4 0v.09a1.6 1.6 0 0 0 .97 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77v.09a1.6 1.6 0 0 0 1.47.97H21a2 2 0 1 1 0 4h-.09a1.6 1.6 0 0 0-1.47.97z" />
    </svg>
  )
}
