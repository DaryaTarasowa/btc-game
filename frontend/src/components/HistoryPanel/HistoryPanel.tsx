import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCompletedBets, reconstructableBetHistory } from "@/api/bets";
import { HistoryBetList } from "@/components/HistoryPanel/HistoryBetList";
import { HistoryLoginRequired } from "@/components/HistoryPanel/HistoryLoginRequired";
import { usePlayer } from "@/context/usePlayer";
import { eyebrowStyle, pageCardStyle, pageTitleStyle } from "@/styles/ui";

const emptyStyle = "mt-10 text-[#8490a9]";

export function HistoryPanel() {
  const { playerId, player } = usePlayer();
  const [selectedBetId, setSelectedBetId] = useState<string | null>(null);
  const history = useQuery({
    queryKey: ["bets", playerId, "history"],
    queryFn: ({ signal }) => getCompletedBets(signal),
    enabled: Boolean(playerId),
  });
  const visibleHistory = reconstructableBetHistory(history.data ?? []);

  function toggleBet(betId: string) {
    setSelectedBetId((current) => (current === betId ? null : betId));
  }

  return (
    <section className={`${pageCardStyle} w-full mt-1`}>
      <p className={eyebrowStyle}>GAME HISTORY</p>
      {playerId ? (
        <>
          <h1 className={pageTitleStyle}>Your predictions</h1>
          <p className="m-0 leading-7 text-slate-300">
            History for{" "}
            <strong className="text-white">{player?.username}</strong>
          </p>
          {history.isPending ? (
            <p className={emptyStyle}>Loading completed predictions…</p>
          ) : history.isError ? (
            <p className="mt-5.5 text-down">{history.error.message}</p>
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
