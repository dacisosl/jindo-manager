import React, { useEffect, useMemo, useRef, useState } from 'react'
import { loadData, saveData } from './storage.js'
import { compute, toISO, GREEN, SUB } from './logic.js'
import GridView from './views/GridView.jsx'
import TimetableView from './views/TimetableView.jsx'
import ScheduleView from './views/ScheduleView.jsx'
import ImportView from './views/ImportView.jsx'
import SettingsModal from './views/SettingsModal.jsx'
import HamilModal from './views/HamilModal.jsx'
import SetupView from './views/SetupView.jsx'
import Snackbar from './views/Snackbar.jsx'
import useWindowWidth from './useWindowWidth.js'

export default function App() {
  const [data, setData] = useState(loadData)
  useEffect(() => saveData(data), [data])

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

  return (
    <div style={{ minHeight: '100vh', padding: isMobile ? '16px 14px 90px' : '26px 44px 110px', boxSizing: 'border-box' }}>
      <div
        data-print="hide"
        style={{
          maxWidth: 1280, margin: '0 auto ' + (isMobile ? 18 : 26) + 'px',
          display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #C9C5BE', paddingBottom: 12,
        }}
      >
        <div
          onClick={() => data.setupDone && go('grid')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: isMobile ? 21 : 25, fontWeight: 800, letterSpacing: '-0.035em',
            cursor: data.setupDone ? 'pointer' : 'default',
          }}
        >
          <span style={{ display: 'inline-block', width: 7, height: isMobile ? 20 : 24, borderRadius: 2, background: GREEN, flex: 'none' }} />
          진도계획표
        </div>
        <div style={{ flex: 1 }} />
        {view === 'setup' ? (
          <button
            data-intro-hamil
            onClick={() => setHamilOpen(true)}
            title="해밀고 데이터 불러오기"
            style={{
              border: 'none', borderRadius: 5, background: GREEN, color: '#FFFFFF',
              fontSize: 12, fontWeight: 700, letterSpacing: '0.02em', padding: '5px 9px', cursor: 'pointer', lineHeight: 1,
            }}
          >
            해밀
          </button>
        ) : (
          <button
            onClick={() => go('setup')}
            title="설정 화면으로 돌아가기"
            className="hov"
            style={{ border: 'none', background: 'none', padding: 5, borderRadius: 6, cursor: 'pointer', display: 'flex', color: SUB }}
          >
            <BackspaceIcon />
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

      {view === 'grid' && <GridView {...ctx} />}
      {view === 'timetable' && <TimetableView {...ctx} />}
      {view === 'schedule' && <ScheduleView {...ctx} />}
      {view === 'import' && <ImportView {...ctx} kind={importKind} />}
      {view === 'setup' && <SetupView {...ctx} onStart={finishSetup} />}

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

function BackspaceIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 5H9.5L3 12l6.5 7H20a1.6 1.6 0 0 0 1.6-1.6V6.6A1.6 1.6 0 0 0 20 5z" />
      <polyline points="15 9.5 11.5 12 15 14.5" />
      <line x1="11.5" y1="12" x2="17.5" y2="12" />
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
