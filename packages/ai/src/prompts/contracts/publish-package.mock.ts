// publish.package.v1 prompt contract
// ArtifactProposal only — does NOT bump canonical version
import { z } from 'zod';

export const PublishPackageContract = z.object({
  artifactType: z.enum(['epub', 'marked_text', 'html_chapter']),
  contentHash: z.string().min(1).max(256),
  metadata: z.object({
    title: z.string().min(1).max(500),
    author: z.string().min(1).max(200).optional(),
    chapterCount: z.number().int().min(1),
    wordCount: z.number().int().min(1),
    generatedAt: z.string().min(1),
  }).passthrough(),
  chapters: z.array(
    z.object({
      chapterNumber: z.number().int().min(1),
      title: z.string().min(1).max(500),
      content: z.string().min(1),
      wordCount: z.number().int().min(1),
    }),
  ).min(1),
}).strict();

export type PublishPackageOutput = z.infer<typeof PublishPackageContract>;

export function mockPublishPackageOutput(): PublishPackageOutput {
  return {
    artifactType: 'marked_text',
    contentHash: 'sha256-mock-publish-abc123def456',
    metadata: {
      title: 'The Last Ember',
      author: 'AI-assisted draft',
      chapterCount: 10,
      wordCount: 23500,
      generatedAt: new Date().toISOString(),
    },
    chapters: [
      {
        chapterNumber: 1,
        title: 'The Debt Collector',
        content: 'Mock chapter 1 prose content...',
        wordCount: 2450,
      },
      {
        chapterNumber: 2,
        title: 'The Underground Archivist',
        content: 'Mock chapter 2 prose content...',
        wordCount: 2300,
      },
    ],
  };
}
