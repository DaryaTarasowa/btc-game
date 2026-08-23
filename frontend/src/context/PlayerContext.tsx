import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  deleteUser,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
} from "aws-amplify/auth";
import { deletePlayer, ensurePlayer, type Player } from "@/api/players";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../queries/queryKeys";

export interface PlayerContextValue {
  playerId: string | null;
  player: Player | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    username: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const PlayerContext = createContext<PlayerContextValue | null>(null);

export function removePlayerQueries(
  queryClient: Pick<ReturnType<typeof useQueryClient>, "removeQueries">,
  playerId: string,
) {
  queryClient.removeQueries({ queryKey: queryKeys.player(playerId) });
  queryClient.removeQueries({ queryKey: queryKeys.bets(playerId) });
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrate = useCallback(async () => {
    await getCurrentUser();
    setPlayer(await ensurePlayer());
  }, []);

  useEffect(() => {
    hydrate()
      .catch(() => setPlayer(null))
      .finally(() => setIsLoading(false));
  }, [hydrate]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      playerId: player?.playerId ?? null,
      player,
      isLoading,
      async login(email, password) {
        const result = await signIn({ username: email, password });
        if (!result.isSignedIn)
          throw new Error("Additional sign-in steps are required.");
        await hydrate();
      },
      async register(email, password, username) {
        const result = await signUp({
          username: email,
          password,
          options: { userAttributes: { email, preferred_username: username } },
        });
        if (!result.isSignUpComplete)
          throw new Error("Account creation could not be completed.");
        const loginResult = await signIn({ username: email, password });
        if (!loginResult.isSignedIn)
          throw new Error(
            "Account was created, but sign-in could not be completed.",
          );
        await hydrate();
      },
      async logout() {
        const departingPlayerId = player?.playerId;
        await signOut();
        if (departingPlayerId) {
          removePlayerQueries(queryClient, departingPlayerId);
        }
        setPlayer(null);
      },
      async deleteAccount() {
        const departingPlayerId = player?.playerId;
        await deletePlayer();
        await deleteUser();
        if (departingPlayerId) {
          removePlayerQueries(queryClient, departingPlayerId);
        }
        setPlayer(null);
      },
    }),
    [hydrate, isLoading, player, queryClient],
  );
  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}
