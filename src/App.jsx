import React, { useEffect, useMemo, useRef, useState } from 'react'
import { loadData, saveData } from './storage.js'
import { compute, toISO, GREEN, INK, SUB } from './logic.js'
import GridView from './views/GridView.jsx'
import DashView from './views/DashView.jsx'
import TimetableView from './views/TimetableView.jsx'
import ScheduleView from './views/ScheduleView.jsx'
import ImportView from './views/ImportView.jsx'
import SettingsView from './views/SettingsView.jsx'
import { Setup1, Setup2 } from './views/SetupView.jsx'
import Snackbar from './views/Snackbar.jsx'

export default function App() {
  const [data, setData] = useState(loadData)
  useEffect(() => saveData(data), [data])

  const [view, setView] = useState(() => (loadData().setupDone ? 'grid' : 'setup1'))
  const [weekOffset, setWeekOffset] = useState(0)
  const [importKind, setImportKind] = useState('timetable')
  const [stagger, setStagger] = useState(false)
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

  const headerShown = view !== 'setup1' && view !== 'setup2'
  const tab = (label, v, weight) => {
    const active = view === v
    return (
      <button
        key={v}
        onClick={() => go(v)}
        className="hov"
        style={{
          border: 'none',
          background: active ? '#F1F0EC' : 'none',
          borderRadius: '6px 6px 0 0',
          padding: '7px 14px 13px',
          marginBottom: -1,
          fontSize: 14,
          fontWeight: active ? 700 : weight ?? 500,
          cursor: 'pointer',
          color: active ? INK : SUB,
          borderBottom: '2px solid ' + (active ? GREEN : 'transparent'),
        }}
      >
        {label}
      </button>
    )
  }

  return (
    <div style={{ minHeight: '100vh', padding: '28px 48px 110px', boxSizing: 'border-box' }}>
      {headerShown && (
        <div
          data-print="hide"
          style={{ maxWidth: 1100, margin: '0 auto 30px', display: 'flex', alignItems: 'baseline', gap: 36, borderBottom: '1px solid #D9D9D9' }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', paddingBottom: 14 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: GREEN, marginRight: 9 }} />
            진도매니저
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
            {tab('진도표', 'grid')}
            {tab('대시보드', 'dash')}
          </div>
          <div style={{ flex: 1 }} />
          {tab('설정', 'settings', 400)}
        </div>
      )}

      {view === 'grid' && <GridView {...ctx} />}
      {view === 'dash' && <DashView {...ctx} />}
      {view === 'timetable' && <TimetableView {...ctx} />}
      {view === 'schedule' && <ScheduleView {...ctx} />}
      {view === 'import' && <ImportView {...ctx} kind={importKind} />}
      {view === 'settings' && <SettingsView {...ctx} />}
      {view === 'setup1' && <Setup1 {...ctx} />}
      {view === 'setup2' && <Setup2 {...ctx} onStart={() => {
        patch({ setupDone: true })
        setWeekOffset(0)
        setStagger(true)
        setView('grid')
        setTimeout(() => setStagger(false), 1600)
      }} />}

      <Snackbar snack={snack} setSnack={setSnack} data={data} setData={setData} />
    </div>
  )
}
