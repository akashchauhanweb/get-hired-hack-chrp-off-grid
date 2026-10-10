/*
  5-node partial mesh. Multiple paths between source (A) and destination (E) so
  alternate-path relaying shines when a link degrades. Hop limit 3 (Meshtastic
  default). Shortest A→E path is 3 hops (A→B→D→E) with an alternate via C.

  Geometry (x,y) is reused by the UI's plan view so the engine and the picture
  agree on where every node is.
*/

export type NodeId = 'A' | 'B' | 'C' | 'D' | 'E'
export type NodeRole = 'source' | 'relay' | 'dest'

export interface MeshNode {
  id: NodeId
  x: number
  y: number
  role: NodeRole
}

export interface MeshLink {
  a: NodeId
  b: NodeId
  /** base per-transmission packet-loss probability, 0..1 */
  loss: number
}

export const HOP_LIMIT = 3

export const NODES: MeshNode[] = [
  { id: 'A', x: 80, y: 190, role: 'source' },
  { id: 'B', x: 250, y: 110, role: 'relay' },
  { id: 'C', x: 300, y: 300, role: 'relay' },
  { id: 'D', x: 500, y: 150, role: 'relay' },
  { id: 'E', x: 640, y: 210, role: 'dest' },
]

export const SOURCE: NodeId = 'A'
export const DEST: NodeId = 'E'

/** Default link loss rates (presenter overrides these live with the faders). */
export const DEFAULT_LINKS: MeshLink[] = [
  { a: 'A', b: 'B', loss: 0.1 },
  { a: 'B', b: 'D', loss: 0.15 },
  { a: 'D', b: 'E', loss: 0.1 },
  { a: 'A', b: 'C', loss: 0.2 },
  { a: 'C', b: 'D', loss: 0.2 },
  { a: 'B', b: 'C', loss: 0.45 },
]

export function linkKey(a: NodeId, b: NodeId): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

export interface Topology {
  nodes: MeshNode[]
  links: MeshLink[]
  /** adjacency: nodeId -> neighbouring nodeIds (respecting dead nodes) */
  neighbours: Map<NodeId, NodeId[]>
}

/** Build a topology, optionally excluding dead nodes (Kill C). */
export function buildTopology(links: MeshLink[], dead: Set<NodeId> = new Set()): Topology {
  const nodes = NODES.filter((n) => !dead.has(n.id))
  const live = links.filter((l) => !dead.has(l.a) && !dead.has(l.b))
  const neighbours = new Map<NodeId, NodeId[]>()
  for (const n of nodes) neighbours.set(n.id, [])
  for (const l of live) {
    neighbours.get(l.a)?.push(l.b)
    neighbours.get(l.b)?.push(l.a)
  }
  return { nodes, links: live, neighbours }
}

export function getNode(id: NodeId): MeshNode {
  const n = NODES.find((x) => x.id === id)
  if (!n) throw new Error(`unknown node ${id}`)
  return n
}

export function lossOf(links: MeshLink[], a: NodeId, b: NodeId): number {
  const k = linkKey(a, b)
  const l = links.find((x) => linkKey(x.a, x.b) === k)
  return l ? l.loss : 1
}

/**
 * Does at least one path exist from src to dst within hopLimit hops, given a
 * set of "up" links? Used to reason about reachability; the live sim still
 * floods packet-by-packet with per-link loss.
 */
export function reachable(topo: Topology, src: NodeId, dst: NodeId, hopLimit: number): boolean {
  const seen = new Set<NodeId>([src])
  let frontier: NodeId[] = [src]
  for (let hop = 0; hop < hopLimit && frontier.length; hop++) {
    const next: NodeId[] = []
    for (const n of frontier) {
      for (const nb of topo.neighbours.get(n) ?? []) {
        if (nb === dst) return true
        if (!seen.has(nb)) {
          seen.add(nb)
          next.push(nb)
        }
      }
    }
    frontier = next
  }
  return false
}
