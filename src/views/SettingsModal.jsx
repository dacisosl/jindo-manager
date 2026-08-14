import React, { useRef, useState } from 'react'
import { GREEN, FAINT, LINE, SUB, WARN, exportCSV } from '../logic.js'
import { getApiKey, setApiKey, getModel, setModel, exportJSON, importJSON } from '../storage.js'
import { checkKey } from '../importer.js'
import Modal from './Modal.jsx'

export default function SettingsModal({ data, setData, computed, today, setSnack, onClose, onResetSetup }) {
  const cfg = data.cfg
  const [open, setOpen] = useState({ sem: true, count: true, data: false, file: false })
  const [key, setKey] = useState(getApiKey)
  const [keyShown, setKeyShown] = useState(false)
  const [model, setModelState] = useState(getModel)
  const [apiStatus, setApiStatus] = useState('')
  const [dataError, setDataError] = useState('')
  const jsonRef = useRef()

  const patch = p => setData(d => ({ ...d, ...p }))
  const setCfg = p => setData(d => ({ ...d, cfg: { ...d.cfg, ...p } }))
  const toggleSec = id => setOpen(o => ({ ...o, [id]: !o[id] }))

  const exams = data.events.filter(e => e.type === '고사').slice().sort((a, b) => (a.start < b.start ? -1 : 1))

  const saveKey = v => {
    setKey(v)
    setApiKey(v)
    setApiStatus('')
  }
  const doCheck = async () => {
    if (!key) {
      setApiStatus('키를 먼저 입력해주세요.')
      return
    }
    setApiStatus('확인 중…')
    try {
      await checkKey(key)
      setApiStatus('연결됨 · 방금 확인')
    } catch {
      setApiStatus('연결 실패 · 키를 확인해주세요.')
    }
  }

  const loadFile = async file => {
    if (!file) return
    setDataError('')
    try {
      const loaded = await importJSON(file)
      const prev = data
      setData(loaded)
      setSnack({ text: '데이터를 불러왔습니다.', kind: 'all', prev })
      onClose()
    } catch (e) {
      setDataError(e.message)
    }
    jsonRef.current.value = ''
  }

  const Toggle = ({ on, onClick }) => (
    <button
      onClick={onClick}
      style={{
        width: 30, height: 16, border: '1px solid ' + (on ? GREEN : '#BDB9B2'), borderRadius: 9,
        background: on ? GREEN : '#FFFFFF', position: 'relative', cursor: 'pointer', padding: 0, flex: 'none',
      }}
    >
      <span style={{ position: 'absolute', top: 2.5, left: on ? 16 : 3, width: 9, height: 9, borderRadius: '50%', background: on ? '#FFFFFF' : FAINT, transition: 'left 150ms' }} />
    </button>
  )

  const Sec = ({ id, title, children }) => (
    <div style={{ borderTop: '1px solid ' + LINE }}>
      <button
        onClick={() => toggleSec(id)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 0', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, textAlign: 'left' }}
      >
        {title} <span style={{ fontSize: 13, color: FAINT, fontWeight: 400 }}>{open[id] ? '−' : '+'}</span>
      </button>
      {open[id] && children}
    </div>
  )

  const row = { display: 'flex', alignItems: 'center', gap: 12 }
  const linkBtn = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: GREEN, textAlign: 'left' }

  return (
    <Modal title="설정" onClose={onClose}>
      <div style={{ marginTop: 16 }}>
        <Sec id="sem" title="학기 설정">
          <div style={{ padding: '0 0 20px', display: 'flex', gap: 24, maxWidth: 380 }}>
            <label style={{ flex: 1, fontSize: 12, color: SUB }}>
              시작일
              <input type="date" value={data.semStart} onChange={e => patch({ semStart: e.target.value })} style={dateInput} />
            </label>
            <label style={{ flex: 1, fontSize: 12, color: SUB }}>
              종료일
              <input type="date" value={data.semEnd} onChange={e => patch({ semEnd: e.target.value })} style={dateInput} />
            </label>
          </div>
        </Sec>

        <Sec id="count" title="차시 카운팅">
          <div style={{ padding: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 15, fontSize: 14 }}>
            <div style={row}>
              <span style={{ flex: 1 }}>고사 후 차시 리셋</span>
              <Toggle on={cfg.examReset} onClick={() => setCfg({ examReset: !cfg.examReset })} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span>기준 고사</span>
              {exams.length ? (
                <select
                  value={cfg.examId ?? exams[0].id}
                  onChange={e => setCfg({ examId: Number(e.target.value) })}
                  style={uSelect}
                >
                  {exams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: 13, color: FAINT }}>일정에 고사를 추가하면 선택할 수 있습니다.</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: FAINT }}>목표는 따로 정하지 않습니다 — 설정된 시간표의 마지막 차시가 곧 목표차시입니다.</div>
          </div>
        </Sec>

        <Sec id="data" title="데이터">
          <div style={{ padding: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
            <button onClick={() => exportJSON(data, today)} style={linkBtn}>전체 데이터 저장 (.json)</button>
            <button onClick={() => jsonRef.current.click()} style={linkBtn}>저장한 파일 불러오기 (.json)</button>
            {dataError && <div style={{ fontSize: 13, color: WARN }}>{dataError}</div>}
            <div style={{ fontSize: 12, color: FAINT }}>불러오면 현재 데이터를 대체합니다. API 키는 파일에 담기지 않습니다.</div>
            <button onClick={() => exportCSV(computed.sessions)} style={{ ...linkBtn, marginTop: 6 }}>진도 데이터 내보내기 (.csv)</button>
            <button onClick={() => { onClose(); onResetSetup() }} style={linkBtn}>최초 설정 다시 하기</button>
            <input ref={jsonRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={e => loadFile(e.target.files[0])} />
          </div>
        </Sec>

        <Sec id="file" title="파일 인식">
          <div style={{ padding: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <input
                type={keyShown ? 'text' : 'password'}
                value={key}
                onChange={e => saveKey(e.target.value)}
                placeholder="sk-or-…"
                autoComplete="off"
                style={{ ...uInput, flex: 1, fontSize: 13, letterSpacing: '0.02em' }}
              />
              <button onClick={() => setKeyShown(!keyShown)} style={linkBtn}>{keyShown ? '가리기' : '표시'}</button>
              <button onClick={doCheck} style={linkBtn}>연결 확인</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 13, color: SUB }}>
              <span>모델</span>
              <input
                value={model}
                onChange={e => { setModelState(e.target.value); setModel(e.target.value) }}
                style={{ ...uInput, flex: 1, fontSize: 13 }}
              />
            </div>
            {apiStatus && <div style={{ fontSize: 13, color: SUB }}>{apiStatus}</div>}
            <div style={{ fontSize: 12, color: FAINT }}>
              키는 이 브라우저에만 저장되며 파일 인식 요청에만 사용됩니다.{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">키 발급</a>
            </div>
          </div>
        </Sec>
        <div style={{ borderTop: '1px solid ' + LINE }} />
      </div>
    </Modal>
  )
}

const uInput = { border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 14, padding: '4px 0' }
const uSelect = { border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 13, padding: '2px 0' }
const dateInput = {
  display: 'block', width: '100%', boxSizing: 'border-box', border: 'none',
  borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 14, padding: '6px 0', marginTop: 5,
}
