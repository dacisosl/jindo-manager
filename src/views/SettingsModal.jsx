import React, { useRef, useState } from 'react'
import { GREEN, FAINT, INK, LINE, SUB, WARN, RED, exportCSV } from '../logic.js'
import { getApiKey, setApiKey, getModel, setModel, exportJSON, importJSON, defaultData } from '../storage.js'
import { checkKey } from '../importer.js'
import Modal from './Modal.jsx'

export default function SettingsModal({ data, setData, computed, today, setSnack, onClose, onResetSetup, onImport }) {
  const [confirmClear, setConfirmClear] = useState(false)
  const cfg = data.cfg
  const [open, setOpen] = useState({ mode: true, sem: true, count: true, view: false, dash: false, print: false, data: false, file: false })
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

  // 펼칠 수 있다는 걸 바로 알아채도록 화살표를 제목 옆에 붙이고 배경으로 강조한다.
  const Sec = ({ id, title, children }) => (
    <div style={{ borderTop: '1px solid ' + LINE }}>
      <button
        onClick={() => toggleSec(id)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '14px 0', border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, textAlign: 'left' }}
      >
        {title}
        <span
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 20, height: 20, borderRadius: 5, flex: 'none',
            background: open[id] ? GREEN : '#E8E5DE',
            color: open[id] ? '#FFFFFF' : SUB,
            transition: 'background 150ms, color 150ms',
          }}
        >
          <svg
            width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open[id] ? 'rotate(180deg)' : 'none', transition: 'transform 180ms' }}
          >
            <polyline points="5 9 12 16 19 9" />
          </svg>
        </span>
      </button>
      {open[id] && children}
    </div>
  )

  // 스위치는 라벨 바로 옆에 — 시선이 멀리 건너뛰지 않게
  const row = { display: 'flex', alignItems: 'center', gap: 10 }
  const SwitchRow = ({ label, on, onClick }) => (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: 'none', background: 'none',
        padding: '5px 0', cursor: 'pointer', fontSize: 14, color: INK, textAlign: 'left',
      }}
    >
      <Toggle on={on} onClick={onClick} />
      {label}
    </button>
  )
  const linkBtn = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: GREEN, textAlign: 'left' }

  return (
    <Modal title="설정" onClose={onClose}>
      <div style={{ marginTop: 16 }}>
        <Sec id="sem" title="학기 설정">
          <div style={{ padding: '0 0 16px', display: 'flex', gap: 24, maxWidth: 380 }}>
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
          <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
            <SwitchRow label="고사 후 1차시부터 다시" on={cfg.examReset} onClick={() => setCfg({ examReset: !cfg.examReset })} />
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
          </div>
        </Sec>

        <Sec id="view" title="글씨 크기">
          <div style={{ padding: '0 0 16px', display: 'flex', gap: 8 }}>
            {[[0.9, '작게'], [1, '보통'], [1.1, '크게'], [1.25, '더 크게']].map(([v, labelText]) => {
              const on = (cfg.fontScale || 1) === v
              return (
                <button
                  key={v}
                  onClick={() => setCfg({ fontScale: v })}
                  style={{
                    flex: 1, border: '1px solid ' + (on ? GREEN : LINE), borderRadius: 6, cursor: 'pointer',
                    background: on ? GREEN : '#FFFFFF', color: on ? '#FFFFFF' : SUB,
                    padding: '9px 0', fontSize: 12 + (v - 1) * 10, fontWeight: on ? 700 : 500,
                  }}
                >
                  {labelText}
                </button>
              )
            })}
          </div>
        </Sec>

        <Sec id="dash" title="대시보드">
          <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14 }}>
            {[['today', '오늘의 수업'], ['progress', '반별 진도'], ['exam', '고사 D-day']].map(([k, labelText]) => (
              <SwitchRow key={k} label={labelText} on={cfg.dash[k]} onClick={() => setCfg({ dash: { ...cfg.dash, [k]: !cfg.dash[k] } })} />
            ))}
          </div>
        </Sec>

        <Sec id="print" title="인쇄">
          <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['s', '작게', '1/4'], ['m', '중간', '1/2'], ['l', '크게', '1']].map(([k, labelText, ratio]) => {
                const on = cfg.printScale === k
                return (
                  <button
                    key={k}
                    onClick={() => setCfg({ printScale: k })}
                    style={{
                      flex: 1, border: '1px solid ' + (on ? GREEN : LINE), borderRadius: 6, cursor: 'pointer',
                      background: on ? GREEN : '#FFFFFF', color: on ? '#FFFFFF' : SUB,
                      padding: '9px 0', fontSize: 13, fontWeight: on ? 700 : 500,
                    }}
                  >
                    {labelText}
                    <div style={{ fontSize: 11, fontWeight: 400, marginTop: 3, opacity: 0.85 }}>A4 {ratio}</div>
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 12, color: FAINT }}></div>
          </div>
        </Sec>

        <Sec id="data" title="데이터">
          <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
            <button onClick={() => exportJSON(data, today)} style={linkBtn}>전체 데이터 저장 (.json)</button>
            <button onClick={() => jsonRef.current.click()} style={linkBtn}>저장한 파일 불러오기 (.json)</button>
            {dataError && <div style={{ fontSize: 13, color: WARN }}>{dataError}</div>}
            <div style={{ fontSize: 12, color: FAINT }}>불러오면 현재 데이터를 대체합니다. API 키는 파일에 담기지 않습니다.</div>
            <button onClick={() => exportCSV(computed.sessions)} style={{ ...linkBtn, marginTop: 6 }}>진도 데이터 내보내기 (.csv)</button>
            <button onClick={() => { onClose(); onResetSetup() }} style={linkBtn}>최초 설정 다시 하기</button>
            <button onClick={() => setConfirmClear(true)} style={{ ...linkBtn, color: RED, fontWeight: 700, marginTop: 4 }}>전체 내용 초기화</button>
            <input ref={jsonRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={e => loadFile(e.target.files[0])} />
          </div>
        </Sec>

        <Sec id="file" title="파일 인식">
          <div style={{ padding: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
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
            <div style={{ display: 'flex', gap: 20, marginTop: 4 }}>
              <button onClick={() => { onClose(); onImport('timetable') }} style={linkBtn}>시간표 파일 가져오기</button>
              <button onClick={() => { onClose(); onImport('schedule') }} style={linkBtn}>학사일정 파일 가져오기</button>
            </div>
          </div>
        </Sec>
        <div style={{ borderTop: '1px solid ' + LINE }} />
      </div>

      {confirmClear && (
        <Modal title="전체 내용 초기화" onClose={() => setConfirmClear(false)} width={400}>
          <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.7 }}>
            시간표, 진도 기록, 일정, 차시별 내용이 모두 지워지고 최초 설정 화면으로 돌아갑니다.
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: FAINT, lineHeight: 1.7 }}>
            되돌릴 수 없습니다. 남겨둘 내용이 있다면 먼저 <b style={{ fontWeight: 600 }}>전체 데이터 저장(.json)</b>으로 백업하세요.
            API 키는 지워지지 않습니다.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, alignItems: 'center', marginTop: 22 }}>
            <button onClick={() => setConfirmClear(false)} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 14, color: SUB }}>
              취소
            </button>
            <button
              onClick={() => {
                setConfirmClear(false)
                setData(defaultData())
                onClose()
                onResetSetup()
              }}
              style={{ border: 'none', borderRadius: 6, padding: '8px 18px', background: RED, color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              초기화
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  )
}

const uInput = { border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 14, padding: '4px 0' }
const uSelect = { border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 13, padding: '2px 0' }
const dateInput = {
  display: 'block', width: '100%', boxSizing: 'border-box', border: 'none',
  borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 14, padding: '6px 0', marginTop: 5,
}
