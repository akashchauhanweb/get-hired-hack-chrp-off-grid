/*
  Managed flood (Meshtastic-style) of ONE packet across the mesh.
  A node that hears a packet for the first time rebroadcasts it once, as long as
  the hop limit allows. Every link transmission is an independent Bernoulli trial
  against that link's loss rate. This is the ONLY simulated layer — it is what a
  real radio would do, and it is what lets us show loss + alternate-path recovery
  live. Deterministic given the RNG, so a run is reproducible.
*/
import type { Rng } from './rng'
import { chance } from './rng'
import type { NodeId, Topology } from './topology'
import { lossOf } from './topology'

export interface TxEvent {
  from: NodeId
  to: NodeId
  hop: number // hops already travelled when this transmission is sent (0 = from source)
  delivered: boolean
}

export interface FloodResult {
  delivered: boolean
  hops: number // hop count of the first copy that reached the destination (0 if none)
  events: TxEvent[]
  airLinks: number // number of link-transmissions attempted (bytes-on-air accounting)
}

/**
 * Flood one packet from `src`, trying to reach `dst`.
 * @param hopLimit max hops a packet may travel.
 */
export function floodPacket(
  topo: Topology,
  src: NodeId,
  dst: NodeId,
  hopLimit: number,
  rng: Rng,
): FloodResult {
  const events: TxEvent[] = []
  const received = new Set<NodeId>([src]) // nodes that already hold the packet
  const rebroadcast = new Set<NodeId>() // nodes that already forwarded it
  let delivered = false
  let deliveredHops = 0
  let airLinks = 0

  // queue of pending broadcasts: who is transmitting, and how many hops already travelled
  let queue: Array<{ node: NodeId; hop: number }> = [{ node: src, hop: 0 }]

  while (queue.length) {
    const next: Array<{ node: NodeId; hop: number }> = []
    for (const { node, hop } of queue) {
      if (rebroadcast.has(node)) continue
      rebroadcast.add(node)
      for (const nb of topo.neighbours.get(node) ?? []) {
        airLinks++
        const ok = chance(rng, 1 - lossOf(topo.links, node, nb))
        events.push({ from: node, to: nb, hop, delivered: ok })
        if (!ok) continue
        if (nb === dst && !delivered) {
          delivered = true
          deliveredHops = hop + 1
        }
        if (!received.has(nb)) {
          received.add(nb)
          // rebroadcast if we still have hops left and it isn't the destination endpoint
          if (hop + 1 < hopLimit && nb !== dst) {
            next.push({ node: nb, hop: hop + 1 })
          }
        }
      }
    }
    queue = next
  }

  return { delivered, hops: deliveredHops, events, airLinks }
}
