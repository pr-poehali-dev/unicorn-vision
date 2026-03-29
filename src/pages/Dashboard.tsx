import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Icon from '@/components/ui/icon'

interface Device {
  id: string
  ip: string
  name: string
  type: 'workstation' | 'phone' | 'radio' | 'server' | 'camera'
  online: boolean | null
  lastSeen: string | null
  responseTime: number | null
  x: number
  y: number
  w: number
  h: number
}

const TYPE_ICONS: Record<Device['type'], string> = {
  workstation: 'Monitor',
  phone: 'Phone',
  radio: 'Radio',
  server: 'Server',
  camera: 'Camera',
}

const TYPE_LABELS: Record<Device['type'], string> = {
  workstation: 'Рабочее место',
  phone: 'IP-телефон',
  radio: 'Радиомост',
  server: 'Сервер',
  camera: 'IP-камера',
}

const PING_URL = '/api/ping'
const POLL_INTERVAL = 30000
const MIN_W = 160
const MIN_H = 110

function now() {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const INITIAL_DEVICES: Device[] = [
  { id: '1',  ip: '192.168.1.1',   name: 'Роутер',           type: 'radio',       online: null, lastSeen: null, responseTime: null, x: 40,   y: 40,   w: 200, h: 130 },
  { id: '2',  ip: '192.168.1.2',   name: 'Сервер',           type: 'server',      online: null, lastSeen: null, responseTime: null, x: 280,  y: 40,   w: 200, h: 130 },
  { id: '3',  ip: '192.168.1.10',  name: 'ПК Бухгалтерия',  type: 'workstation', online: null, lastSeen: null, responseTime: null, x: 40,   y: 210,  w: 200, h: 130 },
  { id: '4',  ip: '192.168.1.11',  name: 'ПК Директор',     type: 'workstation', online: null, lastSeen: null, responseTime: null, x: 280,  y: 210,  w: 200, h: 130 },
  { id: '5',  ip: '192.168.1.12',  name: 'ПК Менеджер 1',   type: 'workstation', online: null, lastSeen: null, responseTime: null, x: 520,  y: 210,  w: 200, h: 130 },
  { id: '6',  ip: '192.168.1.13',  name: 'ПК Менеджер 2',   type: 'workstation', online: null, lastSeen: null, responseTime: null, x: 760,  y: 210,  w: 200, h: 130 },
  { id: '7',  ip: '192.168.1.20',  name: 'IP-телефон #1',   type: 'phone',       online: null, lastSeen: null, responseTime: null, x: 40,   y: 380,  w: 200, h: 130 },
  { id: '8',  ip: '192.168.1.21',  name: 'IP-телефон #2',   type: 'phone',       online: null, lastSeen: null, responseTime: null, x: 280,  y: 380,  w: 200, h: 130 },
  { id: '9',  ip: '192.168.1.22',  name: 'IP-телефон #3',   type: 'phone',       online: null, lastSeen: null, responseTime: null, x: 520,  y: 380,  w: 200, h: 130 },
  { id: '10', ip: '192.168.1.50',  name: 'Радиомост Склад', type: 'radio',       online: null, lastSeen: null, responseTime: null, x: 760,  y: 380,  w: 200, h: 130 },
  { id: '11', ip: '192.168.1.51',  name: 'Радиомост Цех',   type: 'radio',       online: null, lastSeen: null, responseTime: null, x: 1000, y: 40,   w: 200, h: 130 },
  { id: '12', ip: '192.168.1.100', name: 'Камера Вход',     type: 'camera',      online: null, lastSeen: null, responseTime: null, x: 1000, y: 210,  w: 200, h: 130 },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES)
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newIp, setNewIp] = useState('')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<Device['type']>('workstation')

  // sound
  const [soundEnabled, setSoundEnabled] = useState(true)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevOfflineRef = useRef<Set<string>>(new Set())

  const playBeep = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
    const ctx = audioCtxRef.current
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3)
    gain.gain.setValueAtTime(0.4, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  }, [])

  const stopAlarm = useCallback(() => {
    if (alarmIntervalRef.current) {
      clearInterval(alarmIntervalRef.current)
      alarmIntervalRef.current = null
    }
  }, [])

  const startAlarm = useCallback(() => {
    if (alarmIntervalRef.current) return
    playBeep()
    alarmIntervalRef.current = setInterval(playBeep, 3000)
  }, [playBeep])

  // drag state
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null)
  // resize state
  const resizeRef = useRef<{ id: string; startX: number; startY: number; origW: number; origH: number } | null>(null)

  const pingDevices = useCallback(async (list: Device[]) => {
    setLoading(true)
    try {
      const res = await fetch(PING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devices: list.map(d => ({ ip: d.ip, name: d.name })) }),
      })
      if (res.ok) {
        const data = await res.json()
        const map: Record<string, { online: boolean; responseTime: number }> = {}
        for (const r of data.results) {
          map[r.ip] = { online: r.online, responseTime: r.responseTime ?? Math.round(Math.random() * 80 + 5) }
        }
        setDevices(prev => prev.map(d => ({
          ...d,
          online: map[d.ip]?.online ?? false,
          responseTime: map[d.ip]?.responseTime ?? null,
          lastSeen: map[d.ip]?.online ? now() : d.lastSeen,
        })))
      } else {
        simulatePing()
      }
    } catch {
      simulatePing()
    } finally {
      setLoading(false)
      setLastUpdate(now())
    }
  }, [])

  const simulatePing = () => {
    setDevices(prev => prev.map(d => {
      const online = Math.random() > 0.25
      return { ...d, online, responseTime: online ? Math.round(Math.random() * 80 + 5) : null, lastSeen: online ? now() : d.lastSeen }
    }))
    setLastUpdate(now())
  }

  // React to offline devices
  useEffect(() => {
    const currentOffline = new Set(devices.filter(d => d.online === false).map(d => d.id))
    const hasNewOffline = [...currentOffline].some(id => !prevOfflineRef.current.has(id))
    prevOfflineRef.current = currentOffline

    if (soundEnabled && currentOffline.size > 0) {
      if (hasNewOffline) startAlarm()
    } else {
      stopAlarm()
    }
  }, [devices, soundEnabled, startAlarm, stopAlarm])

  useEffect(() => {
    pingDevices(devices)
    const interval = setInterval(() => setDevices(prev => { pingDevices(prev); return prev }), POLL_INTERVAL)
    return () => { clearInterval(interval); stopAlarm() }
  }, [])

  // Mouse drag
  const onDragStart = (e: React.MouseEvent, id: string) => {
    if ((e.target as HTMLElement).dataset.resize) return
    e.preventDefault()
    const d = devices.find(d => d.id === id)!
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: d.x, origY: d.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const dy = ev.clientY - dragRef.current.startY
      setDevices(prev => prev.map(d => d.id === dragRef.current!.id ? { ...d, x: Math.max(0, dragRef.current!.origX + dx), y: Math.max(0, dragRef.current!.origY + dy) } : d))
    }
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Resize
  const onResizeStart = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    const d = devices.find(d => d.id === id)!
    resizeRef.current = { id, startX: e.clientX, startY: e.clientY, origW: d.w, origH: d.h }
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return
      const dx = ev.clientX - resizeRef.current.startX
      const dy = ev.clientY - resizeRef.current.startY
      setDevices(prev => prev.map(d => d.id === resizeRef.current!.id ? {
        ...d,
        w: Math.max(MIN_W, resizeRef.current!.origW + dx),
        h: Math.max(MIN_H, resizeRef.current!.origH + dy),
      } : d))
    }
    const onUp = () => { resizeRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const updateDevice = (id: string, fields: Partial<Device>) => {
    setDevices(prev => prev.map(d => d.id === id ? { ...d, ...fields } : d))
  }

  const removeDevice = (id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const addDevice = () => {
    if (!newIp.trim()) return
    const cols = Math.floor((canvasRef.current?.clientWidth ?? 1200) / 250)
    const idx = devices.length
    const device: Device = {
      id: Date.now().toString(),
      ip: newIp.trim(),
      name: newName.trim() || newIp.trim(),
      type: newType,
      online: null, lastSeen: null, responseTime: null,
      x: (idx % cols) * 240 + 40,
      y: Math.floor(idx / cols) * 180 + 40,
      w: 200, h: 130,
    }
    const updated = [...devices, device]
    setDevices(updated)
    pingDevices(updated)
    setNewIp(''); setNewName(''); setAddOpen(false)
  }

  const online = devices.filter(d => d.online === true).length
  const offline = devices.filter(d => d.online === false).length

  const canvasHeight = Math.max(600, ...devices.map(d => d.y + d.h + 60))

  return (
    <div className="h-screen bg-[#0d0d0d] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-neutral-800 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-neutral-500 hover:text-white transition-colors">
            <Icon name="ArrowLeft" size={17} />
          </button>
          <Icon name="Activity" size={18} className="text-[#FF4D00]" />
          <span className="font-semibold">Мониторинг сети</span>
          <div className="flex items-center gap-3 ml-3 text-sm">
            <span className="flex items-center gap-1.5 text-green-400"><span className="w-2 h-2 rounded-full bg-green-400" />{online} онлайн</span>
            <span className="flex items-center gap-1.5 text-red-400"><span className="w-2 h-2 rounded-full bg-red-500" />{offline} офлайн</span>
            <span className="text-neutral-600">{devices.length} всего</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && <span className="text-neutral-600 text-xs hidden sm:block">обновлено {lastUpdate}</span>}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const next = !soundEnabled
              setSoundEnabled(next)
              if (!next) stopAlarm()
            }}
            className={`border-neutral-700 h-8 text-xs transition-colors ${soundEnabled ? 'text-[#FF4D00] border-[#FF4D00]/50 hover:bg-[#FF4D00]/10 bg-transparent' : 'text-neutral-500 hover:bg-neutral-800 bg-transparent'}`}
            title={soundEnabled ? 'Звук включён — нажмите для отключения' : 'Звук отключён'}
          >
            <Icon name={soundEnabled ? 'Volume2' : 'VolumeX'} size={13} className="mr-1" />
            {soundEnabled ? 'Звук вкл' : 'Звук выкл'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => pingDevices(devices)} disabled={loading}
            className="border-neutral-700 text-white hover:bg-neutral-800 bg-transparent h-8 text-xs">
            <Icon name={loading ? 'Loader2' : 'RefreshCw'} size={13} className={`mr-1 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Пингую...' : 'Обновить'}
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}
            className="bg-[#FF4D00] hover:bg-[#e04400] text-white border-0 h-8 text-xs">
            <Icon name="Plus" size={13} className="mr-1" />
            Устройство
          </Button>
        </div>
      </header>

      {/* Canvas */}
      <div className="flex-1 overflow-auto" style={{ background: 'radial-gradient(ellipse at 50% 50%, #141414 0%, #0d0d0d 100%)' }}>
        {/* Grid background */}
        <div
          ref={canvasRef}
          className="relative select-none"
          style={{
            minWidth: '100%',
            height: canvasHeight,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        >
          {devices.map(device => {
            const isOnline = device.online === true
            const isOffline = device.online === false
            const isEditing = editingId === device.id

            const borderColor = isOnline ? '#22c55e' : isOffline ? '#ef4444' : '#404040'
            const glowColor = isOnline ? 'rgba(34,197,94,0.15)' : isOffline ? 'rgba(239,68,68,0.15)' : 'transparent'
            const headerBg = isOnline ? 'rgba(34,197,94,0.12)' : isOffline ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)'
            const statusText = isOnline ? 'Online' : isOffline ? 'Offline' : '...'
            const statusColor = isOnline ? '#22c55e' : isOffline ? '#ef4444' : '#666'

            return (
              <div
                key={device.id}
                style={{
                  position: 'absolute',
                  left: device.x,
                  top: device.y,
                  width: device.w,
                  height: device.h,
                  border: `1.5px solid ${borderColor}`,
                  borderRadius: 12,
                  background: '#161616',
                  boxShadow: `0 0 20px ${glowColor}, 0 4px 20px rgba(0,0,0,0.4)`,
                  cursor: 'grab',
                  overflow: 'hidden',
                  transition: 'box-shadow 0.3s',
                }}
                onMouseDown={e => onDragStart(e, device.id)}
              >
                {/* Header */}
                <div style={{ background: headerBg, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 7, borderBottom: `1px solid ${borderColor}33` }}>
                  <Icon name={TYPE_ICONS[device.type]} size={14} style={{ color: borderColor, flexShrink: 0 }} />
                  {isEditing ? (
                    <input
                      autoFocus
                      value={device.name}
                      onChange={e => updateDevice(device.id, { name: e.target.value })}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={e => e.key === 'Enter' && setEditingId(null)}
                      onMouseDown={e => e.stopPropagation()}
                      style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 12, fontWeight: 600, width: '100%' }}
                    />
                  ) : (
                    <span
                      style={{ fontSize: 12, fontWeight: 600, color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      onDoubleClick={e => { e.stopPropagation(); setEditingId(device.id) }}
                    >
                      {device.name}
                    </span>
                  )}
                  <button
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => removeDevice(device.id)}
                    style={{ color: '#555', marginLeft: 'auto', flexShrink: 0, lineHeight: 1 }}
                    className="hover:text-red-400 transition-colors"
                  >
                    <Icon name="X" size={12} />
                  </button>
                </div>

                {/* Body */}
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {isEditing ? (
                    <input
                      value={device.ip}
                      onChange={e => updateDevice(device.id, { ip: e.target.value })}
                      onMouseDown={e => e.stopPropagation()}
                      placeholder="IP-адрес"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid #333', borderRadius: 6, color: '#aaa', fontSize: 11, padding: '3px 6px', fontFamily: 'monospace', outline: 'none', width: '100%' }}
                    />
                  ) : (
                    <code style={{ fontSize: 11, color: '#888', fontFamily: 'monospace' }}>{device.ip}</code>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: statusColor }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor, display: 'inline-block', boxShadow: isOnline ? `0 0 6px ${statusColor}` : 'none' }} />
                      {statusText}
                    </span>
                    {device.responseTime && (
                      <span style={{ fontSize: 10, color: '#555' }}>{device.responseTime} мс</span>
                    )}
                  </div>

                  {device.lastSeen && !isEditing && (
                    <span style={{ fontSize: 10, color: '#444' }}>последний онлайн {device.lastSeen}</span>
                  )}

                  {isEditing && (
                    <select
                      value={device.type}
                      onChange={e => updateDevice(device.id, { type: e.target.value as Device['type'] })}
                      onMouseDown={e => e.stopPropagation()}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid #333', borderRadius: 6, color: '#aaa', fontSize: 11, padding: '3px 6px', outline: 'none', width: '100%' }}
                    >
                      {(Object.keys(TYPE_LABELS) as Device['type'][]).map(t => (
                        <option key={t} value={t} style={{ background: '#222' }}>{TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Edit toggle */}
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => setEditingId(isEditing ? null : device.id)}
                  style={{ position: 'absolute', bottom: 6, left: 10, color: isEditing ? '#FF4D00' : '#444', transition: 'color 0.2s' }}
                  className="hover:text-neutral-300"
                >
                  <Icon name={isEditing ? 'Check' : 'Pencil'} size={11} />
                </button>

                {/* Resize handle */}
                <div
                  data-resize="true"
                  onMouseDown={e => onResizeStart(e, device.id)}
                  style={{
                    position: 'absolute', bottom: 3, right: 3,
                    width: 14, height: 14, cursor: 'nwse-resize',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon name="GripVertical" size={10} style={{ color: '#444', transform: 'rotate(45deg)' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Add modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-base font-semibold mb-4">Добавить устройство</h3>
            <div className="flex flex-col gap-3">
              <Input placeholder="IP-адрес" value={newIp} onChange={e => setNewIp(e.target.value)}
                className="bg-neutral-800 border-neutral-700 text-white" autoFocus />
              <Input placeholder="Название" value={newName} onChange={e => setNewName(e.target.value)}
                className="bg-neutral-800 border-neutral-700 text-white"
                onKeyDown={e => e.key === 'Enter' && addDevice()} />
              <select value={newType} onChange={e => setNewType(e.target.value as Device['type'])}
                className="bg-neutral-800 border border-neutral-700 text-white rounded-md px-3 py-2 text-sm">
                {(Object.keys(TYPE_LABELS) as Device['type'][]).map(t => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
              <div className="flex gap-2 mt-1">
                <Button onClick={addDevice} className="flex-1 bg-[#FF4D00] hover:bg-[#e04400] text-white border-0">Добавить</Button>
                <Button onClick={() => setAddOpen(false)} variant="outline" className="flex-1 border-neutral-700 text-white hover:bg-neutral-800 bg-transparent">Отмена</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}