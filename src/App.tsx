/*
  FARCAST — live media delivery over a simulated LoRa mesh.
  The engine is real on real bytes (encrypt → fragment → fountain → relay →
  reassemble → decrypt → hash-verify → render/play); only the radio is simulated.
*/
import { useEffect, useState } from 'react'
import { useSimulation } from './state/useSimulation'
import { heroImage } from './media/image'
import { Masthead } from './ui/Masthead'
import { Topology } from './ui/Topology'
import { EndpointPanel } from './ui/EndpointPanel'
import { PhoneFrame } from './ui/PhoneFrame'
import { AxisMetrics } from './ui/AxisMetrics'
import { ComparisonPanel } from './ui/ComparisonPanel'
import { LinkFaders } from './ui/LinkFaders'
import { Monitoring } from './ui/Monitoring'
import { SecurityPanel } from './ui/SecurityPanel'
import { AuditLog } from './ui/AuditLog'
import { ControlBar } from './ui/ControlBar'
import { BusinessTab } from './ui/BusinessTab'

export function App() {
  const sim = useSimulation()
  const [tab, setTab] = useState<'live' | 'business'>('live')

  // deep-link autostart: ?run=1 sends A→E image, ?bench=1 runs the benchmark
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (!sim.keysReady) return
    if (q.get('run') === '1' && sim.phase === 'idle' && sim.messages.length === 0) {
      heroImage().then((img) =>
        sim.send({ from: 'A', type: 'image', label: img.input.label, payload: img.input.payload, originalRgba: img.originalRgba }),
      )
    }
    if (q.get('bench') === '1' && !sim.comparison && !sim.comparing) sim.runBenchmark()
  }, [sim.keysReady, sim.phase, sim.messages.length, sim.send, sim.comparison, sim.comparing, sim.runBenchmark])

  return (
    <div className="min-h-screen overflow-x-hidden px-5 py-5 lg:px-10" style={{ animation: 'settle 240ms ease-out' }}>
      <Masthead
        bytesOnAir={sim.bytesOnAir}
        goodput={sim.goodput}
        avgLoss={sim.avgLoss}
        tab={tab}
        setTab={setTab}
      />

      {tab === 'live' ? (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 min-w-0 xl:col-span-6">
              <Topology
                links={sim.links}
                dead={sim.dead}
                currentEvents={sim.currentEvents}
                phase={sim.phase}
                onToggleDead={sim.toggleDead}
              />
            </div>
            <div className="col-span-12 min-w-0 md:col-span-6 xl:col-span-3">
              <PhoneFrame>
                <EndpointPanel
                  node="A"
                  mode={sim.mode}
                  phase={sim.phase}
                  busyMessage={sim.busyMessage}
                  messages={sim.messageViews}
                  onSend={sim.send}
                />
              </PhoneFrame>
            </div>
            <div className="col-span-12 min-w-0 md:col-span-6 xl:col-span-3">
              <PhoneFrame>
                <EndpointPanel
                  node="E"
                  mode={sim.mode}
                  phase={sim.phase}
                  busyMessage={sim.busyMessage}
                  messages={sim.messageViews}
                  onSend={sim.send}
                />
              </PhoneFrame>
            </div>
          </div>

          <AxisMetrics sim={sim} />

          <ComparisonPanel
            comparison={sim.comparison}
            comparing={sim.comparing}
            onRun={sim.runBenchmark}
          />

          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-12 min-w-0 lg:col-span-4">
              <LinkFaders links={sim.links} setLinkLoss={sim.setLinkLoss} />
            </div>
            <div className="col-span-12 min-w-0 lg:col-span-5">
              <Monitoring sim={sim} />
            </div>
            <div className="col-span-12 min-w-0 lg:col-span-3">
              <SecurityPanel encrypted={sim.phase !== 'idle'} />
            </div>
          </div>

          <AuditLog rows={sim.ledger} t={sim.airtimeSec} />

          <ControlBar
            mode={sim.mode}
            setMode={sim.setMode}
            preset={sim.preset}
            setPreset={sim.setPreset}
            speed={sim.speed}
            setSpeed={sim.setSpeed}
            dead={sim.dead}
            toggleDead={sim.toggleDead}
            onReset={sim.reset}
          />
        </div>
      ) : (
        <BusinessTab />
      )}

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="label !text-ink-3">
          FARCAST · functional simulation · real media pipeline, simulated radio · no backend
        </span>
        <span className="label !text-ink-3">AES-256-GCM · LT fountain · SHA-256 verified</span>
      </footer>
    </div>
  )
}
