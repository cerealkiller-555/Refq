// ============================================================
// رِفق — Learning Repository
// ============================================================

import { db } from '../schema';
import { BaseRepository } from './baseRepository';
import type {
  LearningPath,
  PathItem,
  Session
} from '../../types';

class LearningPathRepository extends BaseRepository<LearningPath> {
  constructor() {
    super(db.paths);
  }

  async getByStatus(status: LearningPath['status']): Promise<LearningPath[]> {
    return this.table.where('status').equals(status).toArray();
  }

  async getActive(): Promise<LearningPath[]> {
    return this.getByStatus('active');
  }
}

class PathItemRepository extends BaseRepository<PathItem> {
  constructor() {
    super(db.pathItems);
  }

  async getByPath(pathId: string): Promise<PathItem[]> {
    return this.table.where('pathId').equals(pathId).sortBy('order');
  }

  async getChildrenOf(parentId: string): Promise<PathItem[]> {
    return this.table.where('parentId').equals(parentId).sortBy('order');
  }

  async getRootItems(pathId: string): Promise<PathItem[]> {
    return this.table
      .where('pathId')
      .equals(pathId)
      .filter((item) => !item.parentId)
      .sortBy('order');
  }

  async getTodoItems(pathId: string): Promise<PathItem[]> {
    return this.table
      .where('pathId')
      .equals(pathId)
      .filter((item) => item.status !== 'done')
      .sortBy('order');
  }

  async getNextItem(pathId: string): Promise<PathItem | undefined> {
    const todo = await this.getTodoItems(pathId);
    return todo[0];
  }
}

class SessionRepository extends BaseRepository<Session> {
  constructor() {
    super(db.sessions);
  }

  async getByPathItem(pathItemId: string): Promise<Session[]> {
    return this.table.where('pathItemId').equals(pathItemId).toArray();
  }

  async getByDate(date: string): Promise<Session[]> {
    return this.table.where('date').equals(date).toArray();
  }
}

export const learningPathRepository = new LearningPathRepository();
export const pathItemRepository = new PathItemRepository();
export const sessionRepository = new SessionRepository();