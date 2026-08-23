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
import { useQueryClient } from "@tanstack/react-query";

import { deletePlayer, ensurePlayer, type Player } from "@/api/players";
import { queryKeys } from "@/queryKeys";

export interface PlayerContextValue {
  playerId: string | null;
  player: Player | null;
  playerError: Error | null;
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
  const [playerError, setPlayerError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrate = useCallback(async () => {
    await getCurrentUser();
    const hydratedPlayer = await ensurePlayer();

    setPlayer(hydratedPlayer);
    setPlayerError(null);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      try {
        await getCurrentUser();
      } catch {
        setPlayer(null);
        return;
      }

      try {
        const hydratedPlayer = await ensurePlayer();
        setPlayer(hydratedPlayer);
        setPlayerError(null);
      } catch (error) {
        setPlayerError(
          error instanceof Error ? error : new Error("Could not load player."),
        );
      }
    };

    void initialize().finally(() => setIsLoading(false));
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      playerId: player?.playerId ?? null,
      player,
      playerError,
      isLoading,

      async login(email, password) {
        const result = await signIn({
          username: email,
          password,
        });

        if (!result.isSignedIn) {
          throw new Error("Additional sign-in steps are required.");
        }

        await hydrate();
      },

      async register(email, password, username) {
        const result = await signUp({
          username: email,
          password,
          options: {
            userAttributes: {
              email,
              preferred_username: username,
            },
          },
        });

        if (!result.isSignUpComplete) {
          throw new Error("Account creation could not be completed.");
        }

        const loginResult = await signIn({
          username: email,
          password,
        });

        if (!loginResult.isSignedIn) {
          throw new Error(
            "Account was created, but sign-in could not be completed.",
          );
        }

        await hydrate();
      },

      async logout() {
        const departingPlayerId = player?.playerId;

        await signOut();

        if (departingPlayerId) {
          removePlayerQueries(queryClient, departingPlayerId);
        }

        setPlayer(null);
        setPlayerError(null);
      },

      async deleteAccount() {
        const departingPlayerId = player?.playerId;

        await deletePlayer();
        await deleteUser();

        if (departingPlayerId) {
          removePlayerQueries(queryClient, departingPlayerId);
        }

        setPlayer(null);
        setPlayerError(null);
      },
    }),
    [hydrate, isLoading, player, playerError, queryClient],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}
