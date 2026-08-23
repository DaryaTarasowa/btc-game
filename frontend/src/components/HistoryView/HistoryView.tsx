import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCompletedBets, reconstructableBetHistory } from "@/api/bets";
import { HistoryBetList } from "@/components/HistoryView/HistoryBetList";
import { HistoryLoginRequired } from "@/components/HistoryView/HistoryLoginRequired";
import { usePlayer } from "@/context/usePlayer";
import { eyebrowStyle, panelStyle, sectionHeaderStyle } from "@/styles/ui";
import { queryKeys } from "@/queries/queryKeys";

const emptyStyle = "mt-10 text-muted";

export function HistoryView() {
  const { playerId, player } = usePlayer();
  const [selectedBetId, setSelectedBetId] = useState<string | null>(null);
  const history = useQuery({
    queryKey: playerId ? queryKeys.betHistory(playerId) : queryKeys.disabled,
    queryFn: ({ signal }) => getCompletedBets(signal),
    enabled: Boolean(playerId),
  });
  const visibleHistory = reconstructableBetHistory(history.data ?? []);

  function toggleBet(betId: string) {
    setSelectedBetId((current) => (current === betId ? null : betId));
  }

  return (
    <section className={`${panelStyle} w-full mt-1`}>
      <p className={eyebrowStyle}>GAME HISTORY</p>
      {playerId ? (
        <>
          <h1 className={sectionHeaderStyle}>Your predictions</h1>
          <p className="m-0 leading-7 text-muted">
            History for{" "}
            <strong className="text-white">{player?.username}</strong>
          </p>
          {history.isPending ? (
            <p className={emptyStyle}>Loading completed predictions…</p>
          ) : history.isError ? (
            <p className="mt-5.5 text-error">{history.error.message}</p>
          ) : history.data.length === 0 ? (
            <p className={emptyStyle}>No completed predictions yet.</p>
          ) : (
            <HistoryBetList
              bets={visibleHistory.bets}
              olderCount={visibleHistory.olderCount}
              selectedBetId={selectedBetId}
              onSelect={toggleBet}
            />
          )}
        </>
      ) : (
        <HistoryLoginRequired />
      )}
    </section>
  );
}
