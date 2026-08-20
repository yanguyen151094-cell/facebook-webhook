import { useRef, useState } from "react";
import Avatar from "@/components/base/Avatar";
import Modal from "@/components/base/Modal";
import type { ConversationView, Message, User } from "@/types";
import type { InternalNote } from "@/hooks/useInternalNotes";
import { platformMeta, statusMeta, formatTime } from "@/utils/ui";

interface StaffOption {
  id: string;
  name: string;
  username: string;
}

interface ChatViewProps {
  conversation: ConversationView;
  messages: Message[];
  currentUser: User;
  staffOptions: StaffOption[];
  notes: InternalNote[];
  onSend: (content: string) => void;
  onAddNote: (content: string) => void;
  onBack?: () => void;
  onToggleInfo: () => void;
  onAssign: (id: string, staffId: string) => void;
  onStatusChange: (id: string, status: ConversationView["status"]) => void;
  readOnly?: boolean;
}

const EMOJIS = [
  "😀", "😂", "😍", "🥰", "😊", "😘", "👍", "🙏", "❤️", "💖", "🎉", "🤝", "😅", "🥳", "😇", "🤗",
];

export default function ChatView({
  conversation,
  messages,
  currentUser,
  staffOptions,
  notes,
  onSend,
  onAddNote,
  onBack,
  onToggleInfo,
  onAssign,
  onStatusChange,
  readOnly = false,
}: ChatViewProps) {
  const [input, setInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const meta = platformMeta[conversation.channel.platform];
  const st = statusMeta[conversation.status];
  const assignedName =
    conversation.assignments[conversation.assignments.length - 1]?.staffName || "Chưa phân công";

  const scrollToEnd = () => {
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const send = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
    setShowEmoji(false);
    scrollToEnd();
  };

  const addNote = () => {
    const text = note.trim();
    if (!text) return;
    onAddNote(text);
    setNote("");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 md:px-4 py-3 border-b border-background-200">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-600 hover:bg-background-100 cursor-pointer"
            aria-label="Quay lại"
          >
            <i className="ri-arrow-left-line" />
          </button>
        )}
        <Avatar name={conversation.customer.name} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground-900 truncate">
            {conversation.customer.name}
          </p>
          <p className="text-[11px] text-foreground-500 flex items-center gap-1 truncate">
            <i className={`${meta.icon} ${meta.color}`} />
            {meta.label} · Phụ trách: {assignedName}
          </p>
        </div>

        {!readOnly && (
        <div className="hidden lg:flex items-center gap-1.5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full ${st.pill}`}>{st.label}</span>
          {!conversation.assignedStaffId && (
            <button
              type="button"
              onClick={() => onAssign(conversation.id, currentUser.id)}
              className="px-2.5 py-1.5 rounded-md bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 cursor-pointer whitespace-nowrap"
            >
              Nhận hội thoại
            </button>
          )}
          {conversation.status === "completed" ? (
            <button
              type="button"
              onClick={() => onStatusChange(conversation.id, "processing")}
              className="px-2.5 py-1.5 rounded-md bg-background-100 text-foreground-700 text-xs font-medium hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Mở lại
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDone(true)}
              className="px-2.5 py-1.5 rounded-md bg-background-100 text-foreground-700 text-xs font-medium hover:bg-background-200 cursor-pointer whitespace-nowrap"
            >
              Hoàn thành
            </button>
          )}
          <button
            type="button"
            onClick={() => setTransferOpen(true)}
            className="w-8 h-8 rounded-md flex items-center justify-center text-foreground-500 hover:bg-background-100 cursor-pointer"
            title="Chuyển nhân viên"
          >
            <i className="ri-user-shared-line" />
          </button>
        </div>
        )}

        {readOnly && (
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-background-100 text-foreground-500 whitespace-nowrap">
            <i className="ri-lock-line" /> Chỉ xem
          </span>
        )}
        <button
          type="button"
          onClick={onToggleInfo}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-foreground-500 hover:bg-background-100 cursor-pointer"
          aria-label="Thông tin khách hàng"
        >
          <i className="ri-information-line text-lg" />
        </button>
      </div>

      {/* Mobile action bar */}
      {!readOnly && (
      <div className="lg:hidden flex items-center gap-2 px-3 py-2 border-b border-background-200 overflow-x-auto">
        <span className={`text-[10px] px-2 py-0.5 rounded-full ${st.pill} whitespace-nowrap`}>
          {st.label}
        </span>
        {!conversation.assignedStaffId && (
          <button
            type="button"
            onClick={() => onAssign(conversation.id, currentUser.id)}
            className="px-2.5 py-1 rounded-md bg-primary-500 text-white text-xs font-medium cursor-pointer whitespace-nowrap"
          >
            Nhận
          </button>
        )}
        {conversation.status === "completed" ? (
          <button
            type="button"
            onClick={() => onStatusChange(conversation.id, "processing")}
            className="px-2.5 py-1 rounded-md bg-background-100 text-foreground-700 text-xs cursor-pointer whitespace-nowrap"
          >
            Mở lại
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDone(true)}
            className="px-2.5 py-1 rounded-md bg-background-100 text-foreground-700 text-xs cursor-pointer whitespace-nowrap"
          >
            Hoàn thành
          </button>
        )}
        <button
          type="button"
          onClick={() => setTransferOpen(true)}
          className="px-2.5 py-1 rounded-md bg-background-100 text-foreground-700 text-xs cursor-pointer whitespace-nowrap"
        >
          Chuyển
        </button>
      </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto cs-scroll px-3 md:px-5 py-4 space-y-3 bg-background-50">
        {messages.length === 0 && (
          <p className="text-center text-sm text-foreground-400 py-10">
            {readOnly ? "Không có tin nhắn để hiển thị." : "Chưa có tin nhắn nào. Hãy gửi tin nhắn đầu tiên cho khách hàng."}
          </p>
        )}
        {messages.map((m) => {
          const isStaff = m.sender === "staff";
          return (
            <div key={m.id} className={`flex ${isStaff ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] ${isStaff ? "items-end" : "items-start"} flex flex-col`}>
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    isStaff
                      ? "bg-primary-500 text-white rounded-br-md"
                      : "bg-background-100 text-foreground-900 rounded-bl-md"
                  }`}
                >
                  {m.content}
                </div>
                <span className="text-[10px] text-foreground-400 mt-1 px-1">
                  {m.senderName || (isStaff ? "Nhân viên" : conversation.customer.name)} · {formatTime(m.sentAt)}
                </span>
              </div>
            </div>
          );
        })}

        {conversation.customerTyping && (
          <div className="flex justify-start">
            <div className="bg-background-100 text-foreground-400 text-sm px-3.5 py-2.5 rounded-2xl rounded-bl-md flex items-center gap-1">
              <span className="animate-pulse-soft">●</span>
              <span className="animate-pulse-soft" style={{ animationDelay: "0.2s" }}>●</span>
              <span className="animate-pulse-soft" style={{ animationDelay: "0.4s" }}>●</span>
              <span className="ml-1 text-xs">đang nhập</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Internal notes */}
      {showNote && (
        <div className="border-t border-background-200 bg-accent-50/60 px-3 md:px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <i className="ri-sticky-note-line text-accent-700" />
            <p className="text-xs font-semibold text-accent-900">Ghi chú nội bộ (khách không thấy)</p>
          </div>
          {notes.length === 0 && (
            <p className="text-xs text-foreground-400">Chưa có ghi chú.</p>
          )}
          {notes.map((n) => (
            <div key={n.id} className="text-sm text-foreground-700 bg-background-100 rounded-md px-3 py-2 border border-background-200">
              <p>{n.content}</p>
              <p className="text-[10px] text-foreground-400 mt-1">{n.authorName}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              placeholder="Thêm ghi chú..."
              className="flex-1 px-3 py-2 rounded-md border border-background-300 bg-background-50 text-sm text-foreground-900 focus:outline-none focus:ring-2 focus:ring-accent-400"
            />
            <button
              type="button"
              onClick={addNote}
              className="px-3 py-2 rounded-md bg-accent-500 text-white text-sm cursor-pointer whitespace-nowrap"
            >
              Lưu
            </button>
          </div>
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div className="px-3 py-2 border-t border-background-200 bg-background-50 flex gap-1 flex-wrap">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setInput((v) => v + e)}
              className="w-8 h-8 rounded-md text-lg hover:bg-background-100 cursor-pointer"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      {readOnly ? (
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-background-200 bg-background-100">
          <i className="ri-eye-off-line text-foreground-400" />
          <p className="text-sm text-foreground-500 whitespace-nowrap">Chế độ chỉ xem — bạn không có quyền trả lời kênh này.</p>
        </div>
      ) : (
      <div className="flex items-center gap-2 px-3 md:px-4 py-3 border-t border-background-200 bg-background-50">
        <button
          type="button"
          onClick={() => setShowNote((v) => !v)}
          className={`w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer ${
            showNote ? "bg-accent-100 text-accent-700" : "text-foreground-500 hover:bg-background-100"
          }`}
          title="Ghi chú nội bộ"
        >
          <i className="ri-sticky-note-line text-lg" />
        </button>
        <button
          type="button"
          onClick={() => setShowEmoji((v) => !v)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-foreground-500 hover:bg-background-100 cursor-pointer"
          title="Biểu tượng cảm xúc"
        >
          <i className="ri-emotion-line text-lg" />
        </button>
        <button
          type="button"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-foreground-500 hover:bg-background-100 cursor-pointer"
          title="Đính kèm ảnh / tệp"
        >
          <i className="ri-attachment-2 text-lg" />
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Nhập tin nhắn..."
          className="flex-1 px-3.5 py-2.5 rounded-full border border-background-300 bg-background-50 text-sm text-foreground-900 placeholder:text-foreground-300 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <button
          type="button"
          onClick={send}
          className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 cursor-pointer shrink-0"
          aria-label="Gửi"
        >
          <i className="ri-send-plane-fill" />
        </button>
      </div>
      )}

      {/* Transfer modal */}
      <Modal
        open={transferOpen}
        title="Chuyển hội thoại cho nhân viên"
        onClose={() => setTransferOpen(false)}
      >
        <p className="text-sm text-foreground-600 mb-3">
          Chọn nhân viên mới phụ trách khách hàng{" "}
          <span className="font-semibold">{conversation.customer.name}</span>:
        </p>
        <ul className="space-y-1.5 max-h-60 overflow-y-auto cs-scroll">
          {staffOptions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  onAssign(conversation.id, s.id);
                  setTransferOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-background-100 cursor-pointer text-left"
              >
                <Avatar name={s.name} size="sm" />
                <div className="flex-1">
                  <p className="text-sm text-foreground-900">{s.name}</p>
                  <p className="text-[11px] text-foreground-500">@{s.username}</p>
                </div>
                <i className="ri-arrow-right-line text-foreground-400" />
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      {/* Confirm done */}
      <Modal
        open={confirmDone}
        title="Hoàn thành hội thoại"
        onClose={() => setConfirmDone(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmDone(false)}
              className="px-4 py-2 rounded-md bg-background-100 text-foreground-700 text-sm cursor-pointer whitespace-nowrap"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                onStatusChange(conversation.id, "completed");
                setConfirmDone(false);
              }}
              className="px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-medium cursor-pointer whitespace-nowrap"
            >
              Xác nhận
            </button>
          </>
        }
      >
        <p className="text-sm text-foreground-600">
          Đánh dấu hội thoại này là <span className="font-semibold">Hoàn thành</span>? Bạn vẫn có thể
          mở lại sau.
        </p>
      </Modal>
    </div>
  );
}