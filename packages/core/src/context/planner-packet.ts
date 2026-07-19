// context/planner-packet.ts — Minimal stub for M1 phase.
// Planner packet is a restricted-type packet used by the planner AI stage.
// Full implementation requires AI prompt projectors (M4).

export interface PlannerPacket {
  kind: 'restricted';
  projectId: string;
  chapterId: string;
  beatId: string | null;
  restrictedFacts: Array<{
    id: string;
    truth: string;
    factKey: string;
  }>;
}
