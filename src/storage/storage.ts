/**
 * On-device storage layer built directly over AsyncStorage.
 *
 * 100% offline guarantee: AsyncStorage writes to the app's private
 * local storage on the device. There is no network code anywhere in this
 * module — no fetch, no axios, no servers.
 *
 * Two small building blocks:
 *  - `CollectionStore<T>` — a typed key-value-in-a-key store for arbitrary
 *    entity collections. Adding a future module is: define the entity type,
 *    instantiate a `CollectionStore<MyType>('my-collection')` and use its CRUD.
 *  - `KeyValueStore` — plain string-key/value pairs, used for app meta
 *    (e.g. the currently active pet id).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BaseEntity } from '../types';

/** Namespace prefix so app keys never collide with anything else. */
export const STORAGE_PREFIX = '@pet-parent-tracker/';

/** Generates a reasonably unique id for new records. */
export function newId(): string {
  // Date.now base-36 plus a random suffix — collisions practically impossible
  // for an on-device app.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Generic typed collection over AsyncStorage. Each entity type gets its own
 * collection name, which maps to one AsyncStorage key of the shape
 * `@pet-parent-tracker/<name>`. The value is a JSON array of the entity type.
 */
export class CollectionStore<T extends BaseEntity> {
  private readonly key: string;

  constructor(collectionName: string) {
    this.key = STORAGE_PREFIX + collectionName;
  }

  /** Read the whole collection (an empty array when nothing stored yet). */
  async getAll(): Promise<T[]> {
    try {
      const raw = await AsyncStorage.getItem(this.key);
      return raw ? (JSON.parse(raw) as T[]) : [];
    } catch {
      // Corrupt/unreadable data should never crash the app; treat as empty.
      return [];
    }
  }

  /** Replace the whole collection. */
  async setAll(items: T[]): Promise<void> {
    await AsyncStorage.setItem(this.key, JSON.stringify(items));
  }

  /** Find one record by id, or null. */
  async findById(id: string): Promise<T | null> {
    const all = await this.getAll();
    return all.find((item) => item.id === id) ?? null;
  }

  /** Append a brand-new record (assigns id/createdAt if absent). */
  async create(entity: T): Promise<T> {
    const withDefaults: T = {
      ...entity,
      id: entity.id ?? newId(),
      createdAt: entity.createdAt ?? new Date().toISOString(),
    } as T;
    const all = await this.getAll();
    all.push(withDefaults as T);
    await this.setAll(all);
    return withDefaults as T;
  }

  /** Replace an existing record, or append if it doesn't exist yet. */
  async upsert(entity: T): Promise<T> {
    const all = await this.getAll();
    const idx = all.findIndex((item) => item.id === entity.id);
    if (idx === -1) {
      return this.create(entity);
    }
    all[idx] = entity;
    await this.setAll(all);
    return entity;
  }

  /** Update selected fields of a record by id. Returns null if not found. */
  async update(
    id: string,
    changes: Partial<Omit<T, keyof BaseEntity>>,
  ): Promise<T | null> {
    const all = await this.getAll();
    const idx = all.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...changes } as T;
    await this.setAll(all);
    return all[idx];
  }

  /** Delete a record by id. Returns true if something was removed. */
  async remove(id: string): Promise<boolean> {
    const all = await this.getAll();
    const next = all.filter((item) => item.id !== id);
    if (next.length === all.length) return false;
    await this.setAll(next);
    return true;
  }

  /** Delete every record in the collection (used for a future "clear data" action). */
  async removeAll(): Promise<void> {
    await AsyncStorage.removeItem(this.key);
  }
}

/**
 * Simple string key/value store over AsyncStorage — used for app-level meta
 * (right now: the id of the currently active pet).
 */
export class KeyValueStore {
  private readonly key: string;

  constructor(key: string) {
    this.key = STORAGE_PREFIX + key;
  }

  async get(): Promise<string | null> {
    return AsyncStorage.getItem(this.key);
  }

  async set(value: string): Promise<void> {
    await AsyncStorage.setItem(this.key, value);
  }

  async remove(): Promise<void> {
    await AsyncStorage.removeItem(this.key);
  }
}
