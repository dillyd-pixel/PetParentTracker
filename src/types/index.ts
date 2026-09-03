/**
 * Shared domain types for Pet Parent Tracker.
 *
 * `BaseEntity` provides the common fields every persisted collection shares
 * (id + createdAt). Future modules (vaccines, meds, feeding, vet records,
 * expenses, journal, upsell products) extend `BaseEntity` and add their own
 * `CollectionStore<T>`.
 */

/** Common fields for every persisted entity. */
export interface BaseEntity {
  id: string;
  createdAt: string; // ISO timestamp
}

/** Supported pet species (small fixed set). */
export type Species = 'Dog' | 'Cat' | 'Other';

/** Weight units a pet's weight is recorded in. */
export type WeightUnit = 'kg' | 'lb';

/** The Pet entity — stored on-device via AsyncStorage. */
export interface Pet extends BaseEntity {
  name: string;
  species: Species;
  breed?: string;
  birthdate?: string; // ISO date (YYYY-MM-DD)
  weight?: number;
  weightUnit?: WeightUnit;
  photoUri?: string; // local file URI copied into the app's own storage
}

/** Input type for creating/updating a pet (id/createdAt auto-assigned). */
export type PetInput = Omit<Pet, keyof BaseEntity> & Partial<BaseEntity>;

/** Species options exposed for the create/edit form. */
export const SPECIES_OPTIONS: Species[] = ['Dog', 'Cat', 'Other'];

/** Weight unit options exposed for the create/edit form. */
export const WEIGHT_UNIT_OPTIONS: WeightUnit[] = ['kg', 'lb'];

/**
 * The Vaccine entity — stored on-device via AsyncStorage. One record per shot
 * (or per course), bound to a pet via `petId`.
 */
export interface Vaccine extends BaseEntity {
  petId: string;
  /** Vaccine name, e.g. "Rabies (3-year)". */
  name: string;
  /** Date the shot was given (ISO date YYYY-MM-DD). */
  dateGiven: string;
  /** Next due date (ISO date YYYY-MM-DD), optional. */
  dueDate?: string;
  /** Free-form notes, e.g. lot number, vet clinic, reaction. */
  notes?: string;
}

/** Input type for creating/updating a vaccine (id/createdAt auto-assigned). */
export type VaccineInput = Omit<Vaccine, keyof BaseEntity> & Partial<BaseEntity>;

/** How soon a vaccine falls due, computed client-side relative to today. */
export type VaccineStatus =
  | 'overdue' // due date is in the past
  | 'dueSoon' // due date within VACCINE_DUE_SOON_DAYS
  | 'upToDate' // due date further out
  | 'noDueDate'; // no due date set

/** A vaccine whose due date is within this many days counts as "due soon". */
export const VACCINE_DUE_SOON_DAYS = 30;
