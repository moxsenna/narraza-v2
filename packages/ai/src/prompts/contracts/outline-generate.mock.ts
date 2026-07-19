// outline.generate.v1 prompt contract
import { z } from 'zod';

export const OutlineGenerateContract = z.object({
  chapters: z.array(
    z.object({
      chapterNumber: z.number().int().min(1).max(100),
      title: z.string().min(1).max(200),
      summary: z.string().min(10).max(2000),
      beats: z.array(
        z.object({
          beatNumber: z.number().int().min(1).max(20),
          title: z.string().min(1).max(200),
          summary: z.string().min(10).max(1000),
          characters: z.array(z.string().min(1).max(100)).max(10),
          keyReveals: z.array(z.string().min(1).max(500)).max(5).optional(),
        }),
      ).min(1).max(10),
    }),
  ).min(1).max(50),
}).strict();

export type OutlineGenerateOutput = z.infer<typeof OutlineGenerateContract>;

export function mockOutlineGenerateOutput(): OutlineGenerateOutput {
  return {
    chapters: [
      {
        chapterNumber: 1,
        title: 'The Debt Collector',
        summary:
          'Kael extracts a memory from a debtor in the Dust Quarter. During the transfer, she experiences an unexplained flash — a child\'s voice, a burning house. She dismisses it as fatigue, but something has shifted.',
        beats: [
          {
            beatNumber: 1,
            title: 'The Extraction Room',
            summary: 'Kael performs a routine memory extraction on a debtor named Marcus, who has defaulted on his third payment.',
            characters: ['Kael', 'Marcus'],
          },
          {
            beatNumber: 2,
            title: 'The Flash',
            summary: 'During the extraction, Kael sees a vision: a child crying, a house burning, a voice calling her name. She loses focus momentarily.',
            characters: ['Kael'],
          },
          {
            beatNumber: 3,
            title: 'Aftermath',
            summary: 'Kael files her report but conceals the flash. She visits the Quarter\'s bar, where she overhears talk of "unwiped" memories.',
            characters: ['Kael'],
          },
        ],
      },
      {
        chapterNumber: 2,
        title: 'The Underground Archivist',
        summary:
          'Kael follows rumors to Tess\'s hidden archive. Tess shows her records that prove the Guild has been systematically erasing memories of a specific event: the Memory Wars.',
        beats: [
          {
            beatNumber: 1,
            title: 'Following the Thread',
            summary: 'Kael investigates the rumor of unwiped memories, leading her through the back alleys of Memory Row.',
            characters: ['Kael'],
          },
          {
            beatNumber: 2,
            title: 'The Archive',
            summary: 'Kael finds Tess\'s archive — a vast underground library of preserved memories. Tess reveals the Guild\'s pattern of erasures.',
            characters: ['Kael', 'Tess'],
          },
          {
            beatNumber: 3,
            title: 'A Name from the Past',
            summary: 'Tess mentions the name "Finn" while searching archives. Kael freezes — it is her brother\'s name.',
            characters: ['Kael', 'Tess'],
          },
        ],
      },
      {
        chapterNumber: 3,
        title: 'The Memory Wars',
        summary:
          'Tess shares the history of the Memory Wars and Soren\'s role. Kael learns the Guild was built on a foundation of mass trauma erasure covered up as a humanitarian mission.',
        beats: [
          {
            beatNumber: 1,
            title: 'History Lesson',
            summary: 'Tess shares the true history of the Memory Wars, revealing Soren\'s personal involvement.',
            characters: ['Kael', 'Tess'],
          },
          {
            beatNumber: 2,
            title: 'The Guild\'s Secret',
            summary: 'Kael discovers the Guild has been covering up the source of its power — mass memory extraction from war survivors.',
            characters: ['Kael', 'Tess'],
          },
          {
            beatNumber: 3,
            title: 'A Personal Connection',
            summary: 'Kael finds records suggesting her brother Finn\'s memory was among those extracted during the Wars.',
            characters: ['Kael'],
          },
        ],
      },
      {
        chapterNumber: 4,
        title: 'The First Crack',
        summary:
          'Kael attempts a covert search in Guild archives. She is discovered by Soren, who offers her a promotion. Kael realizes Soren is watching her.',
        beats: [
          {
            beatNumber: 1,
            title: 'Into the Spire',
            summary: 'Kael uses her credentials to access restricted Guild archives, searching for Finn\'s records.',
            characters: ['Kael'],
          },
          {
            beatNumber: 2,
            title: 'The Director',
            summary: 'Soren catches Kael but offers her a senior position instead of punishment. Kael senses the threat beneath the offer.',
            characters: ['Kael', 'Soren'],
          },
          {
            beatNumber: 3,
            title: 'The Warning',
            summary: 'Tess warns Kael that Soren\'s promotions are a form of surveillance. Accepting means Soren owns her.',
            characters: ['Kael', 'Tess'],
          },
        ],
      },
      {
        chapterNumber: 5,
        title: 'The Unwiped',
        summary:
          'Kael meets a community of "Unwiped" — people who have refused memory trading. One of them, an elderly woman named Mirren, remembers Finn.',
        beats: [
          {
            beatNumber: 1,
            title: 'The Refuge',
            summary: 'Tess takes Kael to a hidden community of Unwiped who live outside the Guild\'s jurisdiction.',
            characters: ['Kael', 'Tess'],
          },
          {
            beatNumber: 2,
            title: 'Mirren\'s Story',
            summary: 'Mirren, a 70-year-old Unwiped, tells Kael about Finn — a boy who was taken from their neighborhood during the Wars.',
            characters: ['Kael', 'Mirren'],
          },
          {
            beatNumber: 3,
            title: 'A Fragment',
            summary: 'Mirren gives Kael a fragment of a memory capsule — one that contains traces of Finn\'s last day before erasure.',
            characters: ['Kael', 'Mirren', 'Tess'],
          },
        ],
      },
      {
        chapterNumber: 6,
        title: 'Finn\'s Memory',
        summary:
          'Kael views Finn\'s memory fragment. She sees the Guild raid that took him, and a young Soren giving the order. Kael resolves to bring the Guild down.',
        beats: [
          {
            beatNumber: 1,
            title: 'The Capsule',
            summary: 'Kael finally views the memory capsule fragment, experiencing Finn\'s last day.',
            characters: ['Kael'],
          },
          {
            beatNumber: 2,
            title: 'The Raid',
            summary: 'The memory shows Guild enforcers raiding the neighborhood, with a younger Soren directing the operation.',
            characters: ['Kael', 'Soren'],
          },
          {
            beatNumber: 3,
            title: 'Resolution',
            summary: 'Kael emerges from the memory shaken but determined. She tells Tess: "I am going to burn the Guild to the ground."',
            characters: ['Kael', 'Tess'],
          },
        ],
      },
      {
        chapterNumber: 7,
        title: 'The Inside Job',
        summary:
          'Taking Soren\'s promotion as cover, Kael infiltrates the Guild\'s inner circle. She discovers the Memory Vault — where the Guild stores its most dangerous secrets.',
        beats: [
          {
            beatNumber: 1,
            title: 'Accepting the Offer',
            summary: 'Kael formally accepts Soren\'s promotion, entering the Guild\'s senior ranks.',
            characters: ['Kael', 'Soren'],
          },
          {
            beatNumber: 2,
            title: 'The Vault',
            summary: 'Kael discovers the Memory Vault, a secure facility storing the original memories of thousands of erased individuals.',
            characters: ['Kael'],
          },
          {
            beatNumber: 3,
            title: 'Close Call',
            summary: 'Kael nearly triggers an alarm while accessing the Vault records. She narrowly escapes detection.',
            characters: ['Kael'],
          },
        ],
      },
      {
        chapterNumber: 8,
        title: 'The Broadcast',
        summary:
          'Kael and Tess execute a plan to broadcast the Guild\'s crimes to the city. The broadcast goes live, and chaos erupts in the streets.',
        beats: [
          {
            beatNumber: 1,
            title: 'The Plan',
            summary: 'Kael and Tess finalize their plan to expose the Guild using a citywide broadcast hack.',
            characters: ['Kael', 'Tess'],
          },
          {
            beatNumber: 2,
            title: 'Execution',
            summary: 'The broadcast goes live, revealing Soren\'s role in the Memory Wars and the Guild\'s mass erasures.',
            characters: ['Kael', 'Tess', 'Soren'],
          },
          {
            beatNumber: 3,
            title: 'Reaction',
            summary: 'The city erupts in protests. Soren addresses the public, claiming the broadcast is fabricated.',
            characters: ['Soren', 'Kael'],
          },
        ],
      },
      {
        chapterNumber: 9,
        title: 'The Confrontation',
        summary:
          'Soren corners Kael in the Memory Vault. A tense confrontation reveals Soren\'s true history — and the price she paid to build the Guild.',
        beats: [
          {
            beatNumber: 1,
            title: 'The Trap',
            summary: 'Soren traps Kael in the Vault, revealing she knew about Kael\'s investigation all along.',
            characters: ['Kael', 'Soren'],
          },
          {
            beatNumber: 2,
            title: 'The Truth',
            summary: 'Soren reveals her own erased memories — she was a war victim too, and she erased her own pain to become strong.',
            characters: ['Soren'],
          },
          {
            beatNumber: 3,
            title: 'A Choice',
            summary: 'Soren offers Kael a choice: join her in reshaping the Guild, or be erased alongside her brother\'s memory.',
            characters: ['Kael', 'Soren'],
          },
        ],
      },
      {
        chapterNumber: 10,
        title: 'What Remains',
        summary:
          'Kael makes her choice. The Guild begins to reform, memories are returned to the public, and Kael finally faces the grief of losing Finn — without the option to erase it.',
        beats: [
          {
            beatNumber: 1,
            title: 'The Decision',
            summary: 'Kael rejects Soren\'s offer. She triggers a fail-safe Tess had prepared, releasing all Vault memories to the public.',
            characters: ['Kael'],
          },
          {
            beatNumber: 2,
            title: 'The Fall',
            summary: 'Soren is arrested. The Guild begins disbanding. Memories flow back to their owners.',
            characters: ['Kael', 'Soren', 'Tess'],
          },
          {
            beatNumber: 3,
            title: 'Finn',
            summary: 'Kael finds a complete memory capsule of Finn. She sits with his memory — the good and the painful — and finally allows herself to grieve.',
            characters: ['Kael'],
          },
        ],
      },
    ],
  };
}
