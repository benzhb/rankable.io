// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LobbyList } from "../../src/client/components/home/LobbyList.js";
import { CardBank } from "../../src/client/components/game/CardBank.js";
import { PlayerQueue } from "../../src/client/components/game/PlayerQueue.js";
import { TierList } from "../../src/client/components/game/TierList.js";

const card = (id: string) => ({
  id,
  title: `Card ${id}`,
  imageUrl: `https://example.com/${id}.png`,
  storagePath: `anime/${id}.png`,
});

describe("lobby and game layouts", () => {
  it("shows Discord usernames, avatars, and the leader", () => {
    render(<LobbyList members={[{
      participantId: "p1",
      discordUserId: "u1",
      username: "Alex",
      avatarUrl: "https://example.com/avatar.png",
      isLeader: true,
      isSelf: true,
    }]} />);
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByAltText("Alex's profile")).toBeInTheDocument();
    expect(screen.getByLabelText("Party leader")).toBeInTheDocument();
  });

  it("renders only five bank cards and makes only the front card draggable", () => {
    const { container } = render(
      <CardBank
        cards={[1, 2, 3, 4, 5].map((id) => card(String(id)))}
        remainingCount={12}
        endpoint="BANK"
        canMove
        onReturn={() => undefined}
      />,
    );
    expect(screen.getAllByText(/Card [1-5]/)).toHaveLength(5);
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(1);
  });

  it("orders the current player first and highlights them", () => {
    const { container } = render(<PlayerQueue players={[
      { participantId: "p1", username: "Mina", avatarUrl: "/mina.png", isCurrent: true, isSelf: false },
      { participantId: "p2", username: "Devon", avatarUrl: "/devon.png", isCurrent: false, isSelf: true },
    ]} />);
    expect(screen.getAllByText(/Mina|Devon/)[0]).toHaveTextContent("Mina");
    expect(container.querySelector(".queued-player--current")).toHaveTextContent("Mina");
  });

  it("broadcasts a semantic endpoint when the active card is dropped", () => {
    const move = vi.fn();
    const { container } = render(
      <TierList
        placements={[]}
        activeCard={card("1")}
        endpoint="BANK"
        canMove
        onMove={move}
      />,
    );
    const firstTier = container.querySelector(".tier-row")!;
    fireEvent.dragOver(firstTier);
    fireEvent.drop(firstTier);
    expect(move).toHaveBeenCalledWith("S");
  });
});
