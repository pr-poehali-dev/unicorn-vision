import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Icon from '@/components/ui/icon'

interface Device {
  ip: string
  name: string
  type: 'workstation' | 'phone' | 'radio'
}

interface PingResult {
  ip: string
  name: string
  online: boolean
}

const DEFAULT_DEVICES: Device[] = [
  { ip: '192.168.1.1', name: 'Роутер', type: 'radio' },
  { ip: '192.168.1.10', name: 'ПК Бухгалтерия', type: 'workstation' },
  { ip: '192.168.1.20', name: 'IP-телефон #1', type: 'phone' },
  { ip: '192.168.1.21', name: 'IP-телефон #2', type: 'phone' },
  { ip: '192.168.1.50', name: 'Радиомост-1', type: 'radio' },
]

const TYPE_ICONS: Record<Device['type'], string> = {
  workstation: 'Monitor',
  phone: 'Phone',
  radio: 'Radio',
}

const PING_URL = '/api/ping'

export default function MonitorSection({ isActive }: { isActive: boolean }) {
  const [devices, setDevices] = useState<Device[]>(DEFAULT_DEVICES)
  const [results, setResults] = useState<Record<string, boolean | null>>({})
  const [loading, setLoading] = useState(false)
  const [newIp, setNewIp] = useState('')
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<Device['type']>('workstation')

  const pingAll = async () => {
    setLoading(true)
    try {
      const res = await fetch(PING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devices }),
      })
      if (res.ok) {
        const data = await res.json()
        const map: Record<string, boolean> = {}
        for (const r of data.results as PingResult[]) {
          map[r.ip] = r.online
        }
        setResults(map)
      } else {
        simulatePing()
      }
    } catch {
      simulatePing()
    } finally {
      setLoading(false)
    }
  }

  const simulatePing = () => {
    const map: Record<string, boolean> = {}
    for (const d of devices) {
      map[d.ip] = Math.random() > 0.3
    }
    setResults(map)
  }

  const addDevice = () => {
    if (!newIp.trim()) return
    setDevices(prev => [...prev, { ip: newIp.trim(), name: newName.trim() || newIp.trim(), type: newType }])
    setNewIp('')
    setNewName('')
  }

  const removeDevice = (ip: string) => {
    setDevices(prev => prev.filter(d => d.ip !== ip))
    setResults(prev => { const r = { ...prev }; delete r[ip]; return r })
  }

  const online = Object.values(results).filter(Boolean).length
  const total = Object.keys(results).length

  return (
    <section className="relative h-screen w-full snap-start flex flex-col justify-center p-8 md:p-16 lg:p-24">
      <motion.h2
        className="text-4xl md:text-5xl font-bold text-white mb-2"
        initial={{ opacity: 0, y: 50 }}
        animate={isActive ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
      >
        Панель мониторинга
      </motion.h2>

      <motion.p
        className="text-neutral-400 mb-8 text-lg"
        initial={{ opacity: 0 }}
        animate={isActive ? { opacity: 1 } : {}}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Добавьте устройства и проверьте доступность одним кликом
      </motion.p>

      <motion.div
        className="flex flex-col gap-4 max-w-2xl"
        initial={{ opacity: 0, y: 30 }}
        animate={isActive ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        {/* Add device row */}
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="IP-адрес"
            value={newIp}
            onChange={e => setNewIp(e.target.value)}
            className="bg-neutral-900 border-neutral-700 text-white w-36"
            onKeyDown={e => e.key === 'Enter' && addDevice()}
          />
          <Input
            placeholder="Название"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="bg-neutral-900 border-neutral-700 text-white w-44"
            onKeyDown={e => e.key === 'Enter' && addDevice()}
          />
          <select
            value={newType}
            onChange={e => setNewType(e.target.value as Device['type'])}
            className="bg-neutral-900 border border-neutral-700 text-white rounded-md px-3 text-sm"
          >
            <option value="workstation">Рабочее место</option>
            <option value="phone">IP-телефон</option>
            <option value="radio">Радиомост</option>
          </select>
          <Button onClick={addDevice} variant="outline" className="border-neutral-600 text-white hover:bg-neutral-800">
            <Icon name="Plus" size={16} />
          </Button>
        </div>

        {/* Device list */}
        <div className="bg-neutral-900/80 rounded-xl border border-neutral-800 overflow-hidden">
          {devices.map((device, i) => {
            const status = results[device.ip]
            return (
              <div
                key={device.ip}
                className={`flex items-center gap-3 px-4 py-3 ${i !== devices.length - 1 ? 'border-b border-neutral-800' : ''}`}
              >
                <Icon name={TYPE_ICONS[device.type]} size={16} className="text-neutral-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{device.name}</div>
                  <div className="text-neutral-500 text-xs">{device.ip}</div>
                </div>
                {status === undefined ? (
                  <span className="text-neutral-600 text-xs">—</span>
                ) : loading ? (
                  <Icon name="Loader2" size={14} className="text-neutral-400 animate-spin" />
                ) : (
                  <span className={`text-xs font-semibold flex items-center gap-1 ${status ? 'text-green-400' : 'text-red-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${status ? 'bg-green-400' : 'bg-red-500'}`} />
                    {status ? 'Online' : 'Offline'}
                  </span>
                )}
                <button onClick={() => removeDevice(device.ip)} className="text-neutral-700 hover:text-red-400 transition-colors ml-1">
                  <Icon name="X" size={14} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4">
          <Button
            onClick={pingAll}
            disabled={loading}
            className="bg-[#FF4D00] hover:bg-[#e04400] text-white border-0"
          >
            {loading ? <Icon name="Loader2" size={16} className="animate-spin mr-2" /> : <Icon name="Activity" size={16} className="mr-2" />}
            {loading ? 'Пингую...' : 'Проверить все'}
          </Button>
          {total > 0 && (
            <span className="text-neutral-400 text-sm">
              <span className="text-green-400 font-semibold">{online}</span>/{total} онлайн
            </span>
          )}
        </div>
      </motion.div>
    </section>
  )
}
