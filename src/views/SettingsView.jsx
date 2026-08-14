import React, { useState } from 'react'
import { GREEN, FAINT, LINE, SUB, fromISO, exportCSV } from '../logic.js'
import { getApiKey, setApiKey, getModel, setModel } from '../storage.js'
import { checkKey } from '../importer.js'

export default function SettingsView({ data, patch, setData, computed, go }) {
  const cfg = data.cfg
  const [open, setOpen] = useState({ sem: false, count: true, widgets: false, display: false, file: true, data: false })
  const [key, setKey] = useState(getApiKey)
  const [keyShown, setKeyShown] = useState(false)
  const [model, setModelState] = useState(getModel)
  const [apiStatus, setApiStatus] = useState('')

  const setCfg = p => setData(d => ({ ...d, cfg: { ...d.cfg, ...p } }))
  const toggleSec = id => setOpen(o => ({ ...o, [id]: !o[id] }))

  const exams = data.events.filter(e => e.type === '고사').slice().sort((a, b) => (a.start < b.start ? -1 : 1))
  const semD1 = data.semStart ? fromISO(data.semStart) : null
  const semD2 = data.semEnd ? fromISO(data.semEnd) : null
  const semLine = semD1 && semD2
    ? semD1.getFullYear() + '-' + (semD1.getMonth() + 1 >= 3 && semD1.getMonth() + 1 <= 8 ? '1' : '2') + '학기 · ' +
      (semD1.getMonth() + 1) + '.' + semD1.getDate() + ' – ' + (semD2.getMonth() + 1) + '.' + semD2.getDate()
    : '학기 기간이 설정되지 않았습니다.'

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

  const Toggle = ({ on, onClick }) => (
    <button
      onClick={onClick}
      style={{
        width: 30, height: 16, border: '1px solid ' + (on ? GREEN : '#C9C6C0'), borderRadius: 9,
        background: on ? GREEN : '#FFFFFF', position: 'relative', cursor: 'pointer', padding: 0, flex: 'none',
      }}
    >
      <span style={{ position: 'absolute', top: 2.5, left: on ? 16 : 3, width: 9, height: 9, borderRadius: '50%', background: on ? '#FFFFFF' : FAINT, transition: 'left 150ms' }} />
    </button>
  )

  const Sec = ({ id, title, children, last }) => (
    <div style={{ borderTop: '1px solid ' + LINE, borderBottom: last ? '1px solid ' + LINE : 'none' }}>
      <button
        onClick={() => toggleSec(id)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '16px 0', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, textAlign: 'left' }}
      >
        {title} <span style={{ fontSize: 13, color: FAINT, fontWeight: 400 }}>{open[id] ? '−' : '+'}</span>
      </button>
      {open[id] && children}
    </div>
  )

  const row = { display: 'flex', alignItems: 'center', gap: 12 }
  const linkBtn = { border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: GREEN, textAlign: 'left' }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <div style={{ fontSize: 16, fontWeight: 700, paddingBottom: 20 }}>설정</div>

      <Sec id="sem" title="학기">
        <div style={{ padding: '0 0 20px', display: 'flex', alignItems: 'baseline', gap: 16, fontSize: 14 }}>
          <span>{semLine}</span>
          <button onClick={() => go('setup1')} style={linkBtn}>기간 편집</button>
        </div>
      </Sec>

      <Sec id="count" title="차시 카운팅">
        <div style={{ padding: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14 }}>
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
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span>구간 목표 차시</span>
            <input
              type="number"
              value={cfg.target}
              onChange={e => setCfg({ target: Math.max(1, parseInt(e.target.value, 10) || 17) })}
              min={1}
              style={{ ...uInput, width: 52 }}
            />
          </div>
        </div>
      </Sec>

      <Sec id="widgets" title="대시보드 위젯">
        <div style={{ padding: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14 }}>
          {[['week', '이번 주 요약'], ['loss', '결손 통계'], ['forecast', '완주 예측']].map(([k, label]) => (
            <div key={k} style={row}>
              <span style={{ flex: 1 }}>{label}</span>
              <Toggle on={cfg.widgets[k]} onClick={() => setCfg({ widgets: { ...cfg.widgets, [k]: !cfg.widgets[k] } })} />
            </div>
          ))}
        </div>
      </Sec>

      <Sec id="display" title="진도표 표시">
        <div style={{ padding: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 16, fontSize: 14 }}>
          <div style={row}>
            <span style={{ flex: 1 }}>차시 이동 애니메이션</span>
            <Toggle on={cfg.anim} onClick={() => setCfg({ anim: !cfg.anim })} />
          </div>
        </div>
      </Sec>

      <Sec id="file" title="파일 인식">
        <div style={{ padding: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
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

      <Sec id="data" title="데이터" last>
        <div style={{ padding: '0 0 22px', display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14 }}>
          <button onClick={() => exportCSV(computed.sessions)} style={linkBtn}>진도 데이터 내보내기 (.csv)</button>
          <button onClick={() => go('setup1')} style={linkBtn}>최초 설정 다시 하기</button>
        </div>
      </Sec>
    </div>
  )
}

const uInput = { border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 14, padding: '4px 0' }
const uSelect = { border: 'none', borderBottom: '1px solid ' + LINE, background: 'transparent', fontSize: 13, padding: '2px 0' }
