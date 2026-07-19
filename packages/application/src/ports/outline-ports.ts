/**
 * M4 Outline ports: Chapter, ChapterOutline repos.
 */

export interface ChapterOutline {
  id: string;
  projectId: string;
  chapterNumber: number;
  title: string | null;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChapterOutlineInput {
  projectId: string;
  chapterNumber: number;
  title?: string | null;
  summary?: string | null;
}

export interface Chapter {
  id: string;
  projectId: string;
  number: number;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateChapterInput {
  projectId: string;
  number: number;
  title?: string | null;
}

export interface ChapterOutlineRepo {
  create(input: CreateChapterOutlineInput): Promise<ChapterOutline>;
  findById(id: string): Promise<ChapterOutline | null>;
  findByProjectAndNumber(projectId: string, chapterNumber: number): Promise<ChapterOutline | null>;
  findByProjectId(projectId: string): Promise<ChapterOutline[]>;
  /** Upsert title and summary by projectId + chapterNumber. */
  upsert(input: CreateChapterOutlineInput): Promise<ChapterOutline>;
}

export interface ChapterRepo {
  create(input: CreateChapterInput): Promise<Chapter>;
  findById(id: string): Promise<Chapter | null>;
  findByProjectAndNumber(projectId: string, number: number): Promise<Chapter | null>;
  findByProjectId(projectId: string): Promise<Chapter[]>;
  /** Upsert title by projectId + number. */
  upsert(input: CreateChapterInput): Promise<Chapter>;
}
