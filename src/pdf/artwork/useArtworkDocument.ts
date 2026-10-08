/**
 * Custom Pet Artwork — the bridge between the app's stores and the piece.
 *
 * The artwork reads the SAME contexts every other screen reads (the pets and
 * their photos, and the owner's own name from Settings) so there is no second
 * copy of the data, no re-entry, and nothing invented. This hook gathers them
 * into an `ArtworkSource`, hands back the document/HTML builders for a given
 * configuration, and resolves a pet's photo into something the print sheet can
 * carry (see ./photoData) — cached per URI, so switching templates around the
 * same pet reads the file once.
 *
 * 100% offline: it only reads already-loaded local state and the device's own
 * files. Nothing is fetched, nothing is uploaded, and no AI or server is
 * involved in a sheet of this artwork.
 */
import { useCallback, useMemo, useRef } from 'react';

import { usePets } from '../../context/PetContext';
import { useAccount } from '../../context/AccountContext';
import { buildArtworkDocument } from './document';
import type { ArtworkConfig, ArtworkDocument, ArtworkSource } from './document';
import { buildArtworkHtml } from './html';
import { toPrintPhoto } from './photoData';

/** The document builders the artwork screens use. */
export interface ArtworkBuilders {
  /** Build the piece (the on-screen canvas and the pickers read this). */
  document: (config: ArtworkConfig) => ArtworkDocument;
  /** Build the print HTML for the same configuration (PDF + browser print). */
  html: (config: ArtworkConfig) => string;
  /** The gathered stores themselves — the pickers list pets with these. */
  source: ArtworkSource;
  /**
   * The pet's photo as the print sheet needs it (a `data:` URI on a device).
   * Cached per source URI. Null when there is no photo or it cannot be read.
   */
  resolvePhoto: (uri: string | null | undefined) => Promise<string | null>;
}

/** Gather the stores and expose the document/HTML builders for a config. */
export function useArtworkBuilders(): ArtworkBuilders {
  const { pets } = usePets();
  const { username } = useAccount();

  const source = useMemo<ArtworkSource>(
    () => ({ pets, ownerName: username }),
    [pets, username],
  );

  /** One read per photo per visit — the promise itself is cached, so the
   *  concurrent callers (the web frame and a file action) share it. */
  const photoCache = useRef(new Map<string, Promise<string | null>>());

  const resolvePhoto = useCallback(async (uri: string | null | undefined) => {
    if (!uri) return null;
    const cache = photoCache.current;
    const inFlight = cache.get(uri);
    if (inFlight) return inFlight;
    const promise = toPrintPhoto(uri);
    cache.set(uri, promise);
    return promise;
  }, []);

  const document = useCallback(
    (config: ArtworkConfig) => buildArtworkDocument(source, config),
    [source],
  );
  const html = useCallback((config: ArtworkConfig) => buildArtworkHtml(document(config)), [
    document,
  ]);

  return useMemo(
    () => ({ document, html, source, resolvePhoto }),
    [document, html, source, resolvePhoto],
  );
}
