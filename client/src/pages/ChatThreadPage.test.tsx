import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ChatThreadPage from "./ChatThreadPage";

vi.mock("../lib/api", () => ({
  apiFetch: vi.fn(),
}));

// Supabase client used for Realtime subscriptions.
// The implementation will create client/src/lib/supabase.ts exporting `supabase`.
let realtimeCallback: ((payload: { new: Record<string, unknown> }) => void) | null = null;

const mockChannel = {
  on: vi.fn().mockImplementation(
    (
      _event: string,
      _filter: unknown,
      cb: (payload: { new: Record<string, unknown> }) => void,
    ) => {
      realtimeCallback = cb;
      return mockChannel;
    },
  ),
  subscribe: vi.fn().mockReturnValue(mockChannel),
};

const mockSupabase = {
  channel: vi.fn().mockReturnValue(mockChannel),
  removeChannel: vi.fn(),
};

vi.mock("../lib/supabase", () => ({ supabase: mockSupabase }));

const { apiFetch } = await import("../lib/api");
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

const REQUEST_ID = "req-001";
const CURRENT_USER_ID = "user-a1";

// Messages returned by GET /messages/:request_id.
// The implementation enriches each message with sender_display_name so the UI
// can show names without a separate profiles fetch.
const MESSAGES_FIXTURE = [
  {
    id: "msg-001",
    request_id: REQUEST_ID,
    sender_id: CURRENT_USER_ID,
    sender_display_name: "Jamie",
    content: "Hey there!",
    created_at: "2026-01-01T10:00:00Z",
  },
  {
    id: "msg-002",
    request_id: REQUEST_ID,
    sender_id: "user-b1",
    sender_display_name: "Morgan",
    content: "Hi! How are you?",
    created_at: "2026-01-01T10:01:00Z",
  },
];

function mockMessagesSuccess(messages = MESSAGES_FIXTURE) {
  mockApiFetch.mockResolvedValue({
    ok: true,
    json: async () => messages,
  });
}

function mockMessagesError() {
  mockApiFetch.mockResolvedValue({
    ok: false,
    json: async () => ({ error: "Failed to load messages" }),
  });
}

function mockPostSuccess(newMessage = {
  id: "msg-003",
  request_id: REQUEST_ID,
  sender_id: CURRENT_USER_ID,
  sender_display_name: "Jamie",
  content: "See you there!",
  created_at: "2026-01-01T10:02:00Z",
}) {
  // First call is GET (mount), second call is POST (send)
  mockApiFetch
    .mockResolvedValueOnce({ ok: true, json: async () => MESSAGES_FIXTURE })
    .mockResolvedValueOnce({ ok: true, json: async () => newMessage });
}

function renderChatPage() {
  return render(
    <MemoryRouter initialEntries={[`/chat/${REQUEST_ID}`]}>
      <Routes>
        <Route path="/chat/:request_id" element={<ChatThreadPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  realtimeCallback = null;
  mockChannel.on.mockImplementation(
    (
      _event: string,
      _filter: unknown,
      cb: (payload: { new: Record<string, unknown> }) => void,
    ) => {
      realtimeCallback = cb;
      return mockChannel;
    },
  );
  mockChannel.subscribe.mockReturnValue(mockChannel);
  mockSupabase.channel.mockReturnValue(mockChannel);
});

// ─── US-17: Display thread ────────────────────────────────────────────────────

describe("ChatThreadPage — message display", () => {
  it("fetches messages from /messages/:request_id on mount", async () => {
    mockMessagesSuccess();
    renderChatPage();

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/messages/${REQUEST_ID}`,
        expect.objectContaining({ method: undefined }) || expect.anything(),
      ),
    );
  });

  it("shows a loading state while the request is in flight", () => {
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    renderChatPage();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows an error state if the fetch fails", async () => {
    mockMessagesError();
    renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/failed to load messages/i)).toBeInTheDocument();
  });

  it("renders each message's content", async () => {
    mockMessagesSuccess();
    renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Hey there!")).toBeInTheDocument();
    expect(screen.getByText("Hi! How are you?")).toBeInTheDocument();
  });

  it("renders the sender name alongside each message", async () => {
    mockMessagesSuccess();
    renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Jamie")).toBeInTheDocument();
    expect(screen.getByText("Morgan")).toBeInTheDocument();
  });

  it("shows an empty-thread prompt when there are no messages", async () => {
    mockMessagesSuccess([]);
    renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/say something/i)).toBeInTheDocument();
  });
});

// ─── US-18: Send a message ────────────────────────────────────────────────────

describe("ChatThreadPage — composing and sending", () => {
  it("renders a message input and a send button", async () => {
    mockMessagesSuccess();
    renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
  });

  it("disables the send button when the input is empty", async () => {
    mockMessagesSuccess();
    renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });

  it("enables the send button once text is entered", async () => {
    mockMessagesSuccess();
    renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );
    await userEvent.type(screen.getByRole("textbox"), "Hello!");

    expect(screen.getByRole("button", { name: /send/i })).not.toBeDisabled();
  });

  it("POSTs to /messages/:request_id with the message content on submit", async () => {
    mockPostSuccess();
    renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    await userEvent.type(screen.getByRole("textbox"), "See you there!");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/messages/${REQUEST_ID}`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ content: "See you there!" }),
        }),
      ),
    );
  });

  it("clears the input after a message is sent", async () => {
    mockPostSuccess();
    renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "See you there!");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("appends the sent message to the thread", async () => {
    mockPostSuccess();
    renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    await userEvent.type(screen.getByRole("textbox"), "See you there!");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByText("See you there!")).toBeInTheDocument(),
    );
  });

  it("disables the send button while the POST is in flight", async () => {
    let resolvePost: (value: unknown) => void;
    const postPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });

    mockApiFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MESSAGES_FIXTURE })
      .mockReturnValueOnce(postPromise);

    renderChatPage();
    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    await userEvent.type(screen.getByRole("textbox"), "Hello!");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();

    resolvePost!({
      ok: true,
      json: async () => ({
        id: "msg-003",
        request_id: REQUEST_ID,
        sender_id: CURRENT_USER_ID,
        sender_display_name: "Jamie",
        content: "Hello!",
        created_at: "2026-01-01T10:02:00Z",
      }),
    });
  });
});

// ─── US-19: Real-time updates ─────────────────────────────────────────────────

describe("ChatThreadPage — Supabase Realtime subscription", () => {
  it("subscribes to the messages table for this request on mount", async () => {
    mockMessagesSuccess();
    renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    expect(mockSupabase.channel).toHaveBeenCalledWith(
      expect.stringContaining(REQUEST_ID),
    );
    expect(mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `request_id=eq.${REQUEST_ID}`,
      }),
      expect.any(Function),
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it("appends a message that arrives via Realtime to the thread", async () => {
    mockMessagesSuccess();
    renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    const incomingMessage = {
      id: "msg-003",
      request_id: REQUEST_ID,
      sender_id: "user-b1",
      sender_display_name: "Morgan",
      content: "Just arrived via realtime!",
      created_at: "2026-01-01T10:03:00Z",
    };

    // Simulate a Supabase Realtime INSERT event
    realtimeCallback?.({ new: incomingMessage });

    await waitFor(() =>
      expect(
        screen.getByText("Just arrived via realtime!"),
      ).toBeInTheDocument(),
    );
  });

  it("does not duplicate a message already received via POST response", async () => {
    mockPostSuccess();
    renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    await userEvent.type(screen.getByRole("textbox"), "See you there!");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByText("See you there!")).toBeInTheDocument(),
    );

    // Realtime also fires for the same message — should not duplicate
    realtimeCallback?.({
      new: {
        id: "msg-003",
        request_id: REQUEST_ID,
        sender_id: CURRENT_USER_ID,
        sender_display_name: "Jamie",
        content: "See you there!",
        created_at: "2026-01-01T10:02:00Z",
      },
    });

    await waitFor(() =>
      expect(screen.getAllByText("See you there!")).toHaveLength(1),
    );
  });

  it("unsubscribes from the channel when the component unmounts", async () => {
    mockMessagesSuccess();
    const { unmount } = renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    unmount();

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });
});

// ─── Navigation ───────────────────────────────────────────────────────────────

describe("ChatThreadPage — navigation", () => {
  it("renders a back link to the connections list", async () => {
    mockMessagesSuccess();
    renderChatPage();

    await waitFor(() =>
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(),
    );

    const backLink = screen.getByRole("link", { name: /back|connections/i });
    expect(backLink).toBeInTheDocument();
  });
});
