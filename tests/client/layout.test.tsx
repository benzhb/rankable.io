// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LobbyList } from "../../src/client/components/home/LobbyList.js";
import { CardBank } from "../../src/client/components/game/CardBank.js";
import { PlayerQueue } from "../../src/client/components/game/PlayerQueue.js";
import { TierList } from "../../src/client/components/game/TierList.js";
import { EmoteMenu } from "../../src/client/components/game/EmoteMenu.js";
import { SkipNotice } from "../../src/client/components/game/SkipNotice.js";
import { DemocracyVoteModal } from "../../src/client/components/game/DemocracyVoteModal.js";

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

  it("lets Presentation players choose any of the five visible cards", () => {
    const { container } = render(
      <CardBank
        cards={[1, 2, 3, 4, 5].map((id) => card(String(id)))}
        remainingCount={12}
        endpoint="BANK"
        canMove
        allowAnyCard
        onReturn={() => undefined}
      />,
    );
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(5);
  });

  it("highlights only the claimed card in Chaos mode", () => {
    const { container } = render(
      <CardBank
        cards={[card("1"), card("2")]}
        remainingCount={2}
        endpoint="BANK"
        canMove
        onReturn={() => undefined}
        highlightFrontCard={false}
        heldCard={card("3")}
      />,
    );

    const activeCards = container.querySelectorAll(".media-card--active");
    expect(activeCards).toHaveLength(1);
    expect(activeCards[0]).toHaveTextContent("Card 3");
    expect(container.querySelector('[data-card-id="1"]'))
      .not.toHaveClass("media-card--active");
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

  it("renders the compact five-tier board without a D tier", () => {
    const { container } = render(
      <TierList
        placements={[]}
        activeCard={card("1")}
        endpoint="BANK"
        canMove={false}
        onMove={() => undefined}
      />,
    );

    expect(container.querySelectorAll(".tier-row")).toHaveLength(5);
    expect([...container.querySelectorAll(".tier-label")].map((label) => label.textContent))
      .toEqual(["S", "A", "B", "C", "F"]);
  });

  it("opens the emote menu and sends the selected reaction", () => {
    const sendEmote = vi.fn();
    render(<EmoteMenu disabled={false} onEmote={sendEmote} />);

    fireEvent.click(screen.getByRole("button", { name: "Open emotes" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Thumbs down" }));

    expect(sendEmote).toHaveBeenCalledWith("THUMBS_DOWN");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("shows a reaction bubble beside the player who emoted", () => {
    render(<PlayerQueue
      players={[
        { participantId: "p1", username: "Mina", avatarUrl: "/mina.png", isCurrent: true, isSelf: false },
      ]}
      emotes={{
        p1: {
          roundId: "round-1",
          participantId: "p1",
          emote: "THUMBS_UP",
          sentAt: new Date().toISOString(),
        },
      }}
    />);

    expect(screen.getByLabelText("Mina reacted 👍")).toHaveTextContent("👍");
  });

  it("announces a freshly skipped card", () => {
    render(<SkipNotice skippedCard={{
      title: "Mystery Show",
      count: 1,
      skippedAt: new Date().toISOString(),
    }} />);

    expect(screen.getByRole("status")).toHaveTextContent("Mystery Show was skipped");
  });

  it("shows tier votes and Haven't tried in the Democracy modal", () => {
    const vote = vi.fn();
    render(
      <DemocracyVoteModal
        card={card("1")}
        votes={[{
          participantId: "p1",
          username: "Mina",
          avatarUrl: "/mina.png",
          choice: "S",
          isSelf: false,
        }]}
        eligibleVoterCount={2}
        remaining={12}
        disabled={false}
        onVote={vote}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Vote on Card 1" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByAltText("Mina's profile")).toBeInTheDocument();
    expect(within(dialog).getByText("Mina")).toBeInTheDocument();
    const sButton = within(dialog).getByRole("button", { name: "S" });
    expect(sButton.compareDocumentPosition(within(dialog).getByLabelText("S voters")))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.click(within(dialog).getByRole("button", { name: "Haven't tried" }));
    expect(vote).toHaveBeenCalledWith("HAVENT_TRIED");
  });

  it("highlights the Democracy placement during the reveal pause", () => {
    const { container } = render(
      <TierList
        placements={[{ ...card("1"), participantId: null, tier: "A", sortIndex: 0 }]}
        activeCard={null}
        endpoint="BANK"
        canMove={false}
        onMove={() => undefined}
        highlightedCardId="1"
      />,
    );

    expect(container.querySelector(".media-card--highlighted")).toHaveTextContent("Card 1");
  });
});
