export function GameControls() {
  return (
    <div className="game-controls" aria-label="Price prediction controls">
      <button type="button" className="game-controls__button game-controls__button--up">
        <span aria-hidden="true">↑</span> UP
      </button>
      <button type="button" className="game-controls__button game-controls__button--down">
        <span aria-hidden="true">↓</span> DOWN
      </button>
    </div>
  );
}
