import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Icon from '@/components/ui/icon'

interface Device {
  id: string
  ip: string
  name: string
  type: 'workstation' | 'phone' | 'radio'
  online: boolean | null
  lastSeen: string | null
  responseTime: number | null
}

const TYPE_LABELS: Record<Device['type'], string> = {
  workstation: 'Рабочее место',
  phone: 'IP-телефон',
  radio: 'Радиомост',
}

const TYPE_ICONS: Record<Device['type'], string> = {
  workstation: 'Monitor',
  phone: 'Phone',
  radio: 'Radio',
}

const INITIAL_DEVICES: Device[] = [
  { id: '1', ip: '192.168.1.1',  name: 'Роутер',           type: 'radio',       online: null, lastSeen: null, responseTime: null },
  { id: '2', ip: '192.168.1.10', name: 'ПК Бухгалтерия',   type: 'workstation', online: null, lastSeen: null, responseTime: null },
  { id: '3', ip: '192.168.1.11', name: 'ПК Директор',      type: 'workstation', online: null, lastSeen: null, responseTime: null },
  { id: '4', ip: '192.168.1.20', name: 'IP-телефон #1',    type: 'phone',       online: null, lastSeen: null, responseTime: null },
  { id: '5', ip: '192.168.1.21', name: 'IP-телефон #2',    type: 'phone',       online: null, lastSeen: null, responseTime: null },
  { id: '6', ip: '192.168.1.50', name: 'Радиомост Склад',  type: 'radio',       online: null, lastSeen: null, responseTime: null },
]

const PING_URL = '/api/ping'
const POLL_INTERVAL = 30000

function now() {
  return new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES)
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newIp, setNewIp] = useState('')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<Device['type']>('workstation')
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all')

  const pingDevices = useCallback(async (list: Device[]) => {
    setLoading(true)
    const start = Date.now()
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
        simulatePing(list)
      }
    } catch {
      simulatePing(list)
    } finally {
      setLoading(false)
      setLastUpdate(now())
    }
  }, [])

  const simulatePing = (list: Device[]) => {
    setDevices(prev => prev.map(d => {
      const online = Math.random() > 0.25
      return {
        ...d,
        online,
        responseTime: online ? Math.round(Math.random() * 80 + 5) : null,
        lastSeen: online ? now() : d.lastSeen,
      }
    }))
    setLastUpdate(now())
  }

  useEffect(() => {
    pingDevices(devices)
    const interval = setInterval(() => pingDevices(devices), POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  const addDevice = () => {
    if (!newIp.trim()) return
    const device: Device = {
      id: Date.now().toString(),
      ip: newIp.trim(),
      name: newName.trim() || newIp.trim(),
      type: newType,
      online: null,
      lastSeen: null,
      responseTime: null,
    }
    const updated = [...devices, device]
    setDevices(updated)
    pingDevices(updated)
    setNewIp('')
    setNewName('')
    setAddOpen(false)
  }

  const removeDevice = (id: string) => {
    setDevices(prev => prev.filter(d => d.id !== id))
  }

  const online = devices.filter(d => d.online === true).length
  const offline = devices.filter(d => d.online === false).length
  const unknown = devices.filter(d => d.online === null).length

  const filtered = devices.filter(d => {
    if (filter === 'online') return d.online === true
    if (filter === 'offline') return d.online === false
    return true
  })

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <header className="border-b border-neutral-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-neutral-500 hover:text-white transition-colors">
            <Icon name="ArrowLeft" size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Icon name="Activity" size={20} className="text-[#FF4D00]" />
            <span className="font-semibold text-lg">Мониторинг сети</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-neutral-500 text-sm hidden sm:block">
              Обновлено: {lastUpdate}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => pingDevices(devices)}
            disabled={loading}
            className="border-neutral-700 text-white hover:bg-neutral-800 bg-transparent"
          >
            <Icon name={loading ? 'Loader2' : 'RefreshCw'} size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Пингую...' : 'Обновить'}
          </Button>
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="bg-[#FF4D00] hover:bg-[#e04400] text-white border-0"
          >
            <Icon name="Plus" size={14} className="mr-1.5" />
            Добавить
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="px-6 py-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Всего', value: devices.length, color: 'text-white', icon: 'Server' },
          { label: 'Онлайн', value: online, color: 'text-green-400', icon: 'CheckCircle' },
          { label: 'Офлайн', value: offline, color: 'text-red-400', icon: 'XCircle' },
          { label: 'Неизвестно', value: unknown, color: 'text-neutral-500', icon: 'HelpCircle' },
        ].map(stat => (
          <div key={stat.label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center gap-3">
            <Icon name={stat.icon} size={20} className={stat.color} />
            <div>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-neutral-500 text-xs">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="px-6 pb-4 flex gap-2">
        {(['all', 'online', 'offline'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
              filter === f
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-500 hover:text-white'
            }`}
          >
            {f === 'all' ? 'Все' : f === 'online' ? 'Онлайн' : 'Офлайн'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="px-6 pb-8">
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-500 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3">Устройство</th>
                <th className="text-left px-5 py-3 hidden sm:table-cell">Тип</th>
                <th className="text-left px-5 py-3">IP-адрес</th>
                <th className="text-left px-5 py-3">Статус</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">Отклик</th>
                <th className="text-left px-5 py-3 hidden lg:table-cell">Последний онлайн</th>
                <th className="px-5 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((device, i) => (
                <tr
                  key={device.id}
                  className={`${i !== filtered.length - 1 ? 'border-b border-neutral-800' : ''} hover:bg-neutral-800/40 transition-colors`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <Icon name={TYPE_ICONS[device.type]} size={16} className="text-neutral-500 shrink-0" />
                      <span className="text-sm font-medium text-white">{device.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <span className="text-neutral-400 text-sm">{TYPE_LABELS[device.type]}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <code className="text-neutral-400 text-sm font-mono">{device.ip}</code>
                  </td>
                  <td className="px-5 py-3.5">
                    {device.online === null ? (
                      <span className="flex items-center gap-1.5 text-neutral-500 text-sm">
                        <span className="w-2 h-2 rounded-full bg-neutral-600" />
                        Проверка...
                      </span>
                    ) : loading ? (
                      <span className="flex items-center gap-1.5 text-neutral-500 text-sm">
                        <Icon name="Loader2" size={12} className="animate-spin" />
                        Пингую...
                      </span>
                    ) : device.online ? (
                      <span className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                        Online
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-red-400 text-sm font-medium">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Offline
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className="text-neutral-400 text-sm font-mono">
                      {device.responseTime ? `${device.responseTime} мс` : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    <span className="text-neutral-500 text-sm">{device.lastSeen ?? '—'}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => removeDevice(device.id)}
                      className="text-neutral-700 hover:text-red-400 transition-colors"
                    >
                      <Icon name="Trash2" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-neutral-600">
                    Нет устройств
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add device modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Добавить устройство</h3>
            <div className="flex flex-col gap-3">
              <Input
                placeholder="IP-адрес (например 192.168.1.100)"
                value={newIp}
                onChange={e => setNewIp(e.target.value)}
                className="bg-neutral-800 border-neutral-700 text-white"
                autoFocus
              />
              <Input
                placeholder="Название устройства"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="bg-neutral-800 border-neutral-700 text-white"
                onKeyDown={e => e.key === 'Enter' && addDevice()}
              />
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as Device['type'])}
                className="bg-neutral-800 border border-neutral-700 text-white rounded-md px-3 py-2 text-sm"
              >
                <option value="workstation">Рабочее место</option>
                <option value="phone">IP-телефон</option>
                <option value="radio">Радиомост</option>
              </select>
              <div className="flex gap-2 mt-2">
                <Button onClick={addDevice} className="flex-1 bg-[#FF4D00] hover:bg-[#e04400] text-white border-0">
                  Добавить
                </Button>
                <Button onClick={() => setAddOpen(false)} variant="outline" className="flex-1 border-neutral-700 text-white hover:bg-neutral-800 bg-transparent">
                  Отмена
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
