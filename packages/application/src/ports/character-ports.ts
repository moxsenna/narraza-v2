export interface Character {
  id: string;
  projectId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateCharacterInput {
  projectId: string;
  name: string;
}

export interface CharacterRepo {
  findById(id: string): Promise<Character | null>;
  findActiveByProjectId(projectId: string): Promise<Character[]>;
  create(input: CreateCharacterInput): Promise<Character>;
  updateName(id: string, name: string): Promise<Character | null>;
  softDelete(id: string): Promise<Character | null>;
}
