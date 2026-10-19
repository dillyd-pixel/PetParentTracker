/**
 * The pet page's cross-tab deep links into the More tab's Sitter stack —
 * 🩺 Vet visit prep (`pet-vet-mode`), 🚨 Emergency info (`pet-emergency-info`)
 * and 🧳 Printable binder (`pet-handoff-binder`, added by OS-mapping chunk 2).
 *
 * Every row that opens a Sitter screen from a pet page goes through this file.
 * Such a screen lives two navigators away from the Pets tab, and that stack is
 * not mounted until one of the rows is tapped. React Navigation then *creates*
 * it at the wanted screen: the Sitter stack holds that screen and nothing
 * beneath it, and the More stack holds the Sitter stack and nothing beneath
 * that. A plain `goBack()` therefore finds no route to pop in either stack and
 * bubbles up to the tab navigator, which answers GO_BACK by focusing its first
 * tab — so `‹ Back` landed on Home instead of the pet page it came from.
 *
 * The repair is a return target written into the deep-link params by this one
 * entry point, and honoured by a screen only when it is there:
 *
 *  - `from: 'pet'` + `petId` → `‹ Back` returns to *that pet's* page and puts
 *    the More tab back on its own menu (a reset, because the stacks it is
 *    leaving were created at this screen and may have nothing to pop).
 *  - no `from` — the screen was reached the normal way (More → Sitter Mode →
 *    Vet Mode / Emergency / Printable binder) — → `goBack()` does exactly what
 *    it always did: one step back to Sitter Home. Nothing about the natural
 *    path changed.
 *
 * Every pet-page row goes through `openSitterScreenFromPetPage` and every screen
 * reads the same param through `usePetDeepLinkBack`, so the entries cannot
 * drift into different shapes. Navigation only: no store, no gate, no screen
 * business logic is touched, and nothing here reaches the network.
 */
import { useCallback } from 'react';
import { CommonActions } from '@react-navigation/native';

import { useTabRootNavigation } from './RootNavigator';
import type { TabRootNavigation } from './RootNavigator';

/** The route the More tab sits on when nothing is stacked on top of it. */
const MORE_HOME_ROUTE = 'MoreHome';

/** The param value that marks a Sitter screen as opened from a pet page. */
export const PET_DEEP_LINK_ORIGIN = 'pet';

/** Who sent the user to this screen — only a pet page ever writes this. */
export type PetDeepLinkOrigin = typeof PET_DEEP_LINK_ORIGIN;

/**
 * The deep-link params the two pet-page rows send. `petId` is the pet whose page
 * the row was on; `from` is the return target.
 */
export type PetDeepLinkParams = {
  petId?: string;
  from?: PetDeepLinkOrigin;
};

/** The Sitter-stack screens the pet page links to. */
export type PetDeepLinkScreen = 'VetMode' | 'Emergency' | 'PrintableBinder';

/** The reset action used to put the More tab back on its menu. */
type ResetAction = ReturnType<typeof CommonActions.reset>;

/**
 * Just the navigation surface the back action needs: `goBack()` for the normal
 * path, `getParent()` (the More stack) for the deep-linked one.
 */
export type PetDeepLinkBackNavigation = {
  goBack: () => void;
  getParent: () => { dispatch: (action: ResetAction) => void } | undefined;
};

/**
 * Open one of the Sitter stack's screens for a pet, from that pet's page.
 *
 * Both the pet page's rows call this — the only place the `from: 'pet'` return
 * target is written — so Vet Mode and Emergency always arrive in the same
 * shape and behave the same way on the way back.
 */
export function openSitterScreenFromPetPage(
  rootNavigation: TabRootNavigation,
  screen: PetDeepLinkScreen,
  petId: string,
): void {
  const params: PetDeepLinkParams = { petId, from: PET_DEEP_LINK_ORIGIN };
  if (screen === 'VetMode') {
    rootNavigation.navigate('More', {
      screen: 'Sitter',
      params: { screen: 'VetMode', params },
    });
    return;
  }
  if (screen === 'PrintableBinder') {
    rootNavigation.navigate('More', {
      screen: 'Sitter',
      params: { screen: 'PrintableBinder', params },
    });
    return;
  }
  rootNavigation.navigate('More', {
    screen: 'Sitter',
    params: { screen: 'Emergency', params },
  });
}

/**
 * The `‹ Back` action for a Sitter screen that may have been deep-linked from a
 * pet page.
 *
 * Not deep-linked → `goBack()`, unchanged. Deep-linked → the pet's page, with
 * the More tab left on its menu so it never shows a stale child or an empty
 * stack afterwards.
 */
export function usePetDeepLinkBack(
  navigation: PetDeepLinkBackNavigation,
  params: PetDeepLinkParams | undefined,
): () => void {
  const rootNavigation = useTabRootNavigation();
  const deepLinked = params?.from === PET_DEEP_LINK_ORIGIN;
  const petId = params?.petId;

  return useCallback(() => {
    if (!deepLinked || !petId) {
      navigation.goBack();
      return;
    }
    // Back to the pet page the row was on — the same pet, not the active one.
    rootNavigation.navigate('Pets', { screen: 'PetProfile', params: { petId } });
    // And leave the More tab on its own menu. A reset rather than a pop: this
    // stack was created *at* the deep-linked screen, so there may be nothing
    // beneath it to pop.
    navigation
      .getParent()
      ?.dispatch(CommonActions.reset({ index: 0, routes: [{ name: MORE_HOME_ROUTE }] }));
  }, [deepLinked, navigation, petId, rootNavigation]);
}
