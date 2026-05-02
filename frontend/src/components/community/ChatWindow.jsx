import { useEffect, useRef, useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { useChat } from '../../hooks/useChat';
import { FiSend } from 'react-icons/fi';
import { format } from 'date-fns';

/**
 * Generic chat window component.
 * Works for group chats today; can power DMs in the future by changing props.
 *
 * Props:
 *   roomType    - 'group' | 'dm'
 *   roomId      - MongoDB _id of the Group or Conversation
 *   initialMessages - pre-fetched messages array from REST API
 *   canChat     - boolean (false = show a "join to chat" prompt instead of input)
 *   emptyText   - message shown when there are no messages yet
 */
export default function ChatWindow({
  roomType,
  roomId,
  initialMessages = [],
  canChat = false,
  emptyText = 'No messages yet. Say hello!',
  className = '',
}) {
  const { user } = useContext(AuthContext);
  const token = user?.token;
  const currentUserId = user?._id;

  const { messages, setMessages, connected, sendMessage } = useChat(
    canChat ? roomType : null,
    canChat ? roomId : null,
    token
  );

  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);
  const initialized = useRef(false);

  // Seed initial messages from REST only once
  useEffect(() => {
    if (!initialized.current && initialMessages.length > 0) {
      setMessages(initialMessages);
      initialized.current = true;
    }
  }, [initialMessages, setMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessage(inputText);
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={`flex flex-col bg-base-100 overflow-hidden ${className || 'rounded-2xl'}`}
      style={className ? undefined : { height: '520px' }}
    >
      {/* Connection status bar */}
      {canChat && (
        <div
          className={`text-xs px-4 py-1 text-center transition-colors ${
            connected ? 'bg-success/10 text-success' : 'bg-base-200 text-base-content/40'
          }`}
        >
          {connected ? 'Live' : 'Connecting…'}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-base-content/40 text-sm">
            {emptyText}
          </div>
        )}

        {messages.map((msg, idx) => {
          const isOwn = msg.sender?._id === currentUserId || msg.sender === currentUserId;
          const senderName = msg.sender?.username ?? 'Unknown';
          const avatar = msg.sender?.profile_pic_url;
          const time = msg.createdAt ? format(new Date(msg.createdAt), 'HH:mm') : '';

          return (
            <div
              key={msg._id ?? idx}
              className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className="avatar flex-shrink-0">
                {avatar ? (
                  <div className="w-8 rounded-full">
                    <img src={avatar} alt={senderName} />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-neutral flex items-center justify-center text-xs font-bold text-neutral-content">
                    {senderName[0]?.toUpperCase()}
                  </div>
                )}
              </div>

              {/* Bubble */}
              <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isOwn && (
                  <span className="text-xs text-base-content/50 px-1">{senderName}</span>
                )}
                <div
                  className={`px-4 py-2 rounded-2xl text-sm break-words ${
                    isOwn
                      ? 'bg-primary text-primary-content rounded-br-sm'
                      : 'bg-base-200 text-base-content rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-xs text-base-content/30 px-1">{time}</span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {canChat ? (
        <div className="border-t border-base-200 p-3 flex gap-2 items-end">
          <textarea
            className="textarea textarea-bordered flex-1 resize-none text-sm min-h-[2.5rem] max-h-32"
            placeholder="Type a message… (Enter to send)"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className="btn btn-primary btn-sm h-10 w-10 p-0 flex-shrink-0"
            onClick={handleSend}
            disabled={!inputText.trim() || !connected}
            aria-label="Send"
          >
            <FiSend size={16} />
          </button>
        </div>
      ) : (
        <div className="border-t border-base-200 p-4 text-center text-sm text-base-content/50">
          Join this group to participate in the chat.
        </div>
      )}
    </div>
  );
}
