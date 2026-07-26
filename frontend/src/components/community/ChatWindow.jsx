import { useEffect, useRef, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import EmojiPicker from 'emoji-picker-react';
import { AuthContext } from '../../context/AuthContext';
import { useChat } from '../../hooks/useChat';
import { useTranslation } from 'react-i18next';
import RecommendationCard from './RecommendationCard';
import AnalyzeModal from '../AnalyzeModal';
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
  emptyText,
  className = '',
}) {
  const { t } = useTranslation();
  emptyText = emptyText || t('No messages yet. Say something!');
  const { user } = useContext(AuthContext);
  const token = user?.token;
  const currentUserId = user?._id;

  const {
    messages,
    setMessages,
    connected,
    sendMessage,
    loadOlderMessages,
    hasMoreMessages,
    loadingOlderMessages,
  } = useChat(canChat ? roomType : null, canChat ? roomId : null, token);

  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const initialized = useRef(false);
  const currentRoomId = useRef(null);
  const suppressScrollRef = useRef(false);

  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [selectedAnalysisData, setSelectedAnalysisData] = useState(null);

  const mergeMessages = (base, incoming) => {
    const ids = new Set(base.map((msg) => msg._id));
    const merged = [...base];
    incoming.forEach((msg) => {
      if (msg._id && !ids.has(msg._id)) {
        merged.push(msg);
        ids.add(msg._id);
      }
    });
    return merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  };

  // Seed initial messages from REST when the room changes
  useEffect(() => {
    if (currentRoomId.current !== roomId) {
      currentRoomId.current = roomId;
      setMessages(initialMessages);
      initialized.current = true;
      return;
    }

    if (messages.length === 0) {
      setMessages(initialMessages);
      initialized.current = true;
      return;
    }

    // We already have local / optimistic messages for this room,
    // merge server-loaded messages without overwriting the current list.
    setMessages((prev) => mergeMessages(prev, initialMessages));
  }, [initialMessages, roomId, messages.length, setMessages]);

  // Scroll to bottom when NEW messages arrive (not on initial load)
  useEffect(() => {
    if (!initialized.current) return;
    if (suppressScrollRef.current) {
      suppressScrollRef.current = false;
      return;
    }
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleLoadOlderMessages = async () => {
    if (!loadOlderMessages || loadingOlderMessages || !messagesContainerRef.current) return;

    const previousScrollHeight = messagesContainerRef.current.scrollHeight;
    suppressScrollRef.current = true;

    const olderMessages = await loadOlderMessages();
    if (olderMessages.length > 0 && messagesContainerRef.current) {
      requestAnimationFrame(() => {
        messagesContainerRef.current.scrollTop =
          messagesContainerRef.current.scrollHeight - previousScrollHeight;
      });
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    const clientTempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimisticMessage = {
      _id: clientTempId,
      text: inputText.trim(),
      sender: {
        _id: currentUserId,
        username: user?.username,
        profile_pic_url: user?.profile_pic_url,
      },
      createdAt: new Date().toISOString(),
      type: 'text',
      status: 'pending',
      clientTempId,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    sendMessage(inputText, clientTempId);
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
          {connected ? t('Live') : t('Connecting…')}
        </div>
      )}

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {hasMoreMessages && (
          <div className="flex justify-center">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={handleLoadOlderMessages}
              disabled={loadingOlderMessages}
            >
              {loadingOlderMessages ? t('Loading earlier messages…') : t('Load earlier messages')}
            </button>
          </div>
        )}

        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-base-content/40 text-sm">
            {emptyText}
          </div>
        )}

        {messages.map((msg, idx) => {
          const isOwn = msg.sender?._id === currentUserId || msg.sender === currentUserId;
          const senderName = msg.sender?.username ?? t('Unknown');
          const avatar = msg.sender?.profile_pic_url;
          const time = msg.createdAt ? format(new Date(msg.createdAt), 'HH:mm') : '';

          // Render recommendation messages differently
          if (msg.type === 'recommendation') {
            return (
              <div
                key={msg._id ?? idx}
                className={`flex items-start gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <Link
                  to={isOwn ? "/profile" : `/profile/${msg.sender?._id || msg.sender}`}
                  className="avatar flex-shrink-0 mt-0.5 hover:opacity-80 transition-opacity"
                >
                  {avatar ? (
                    <div className="w-8 rounded-full">
                      <img src={avatar} alt={senderName} />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral flex items-center justify-center text-xs font-bold text-neutral-content">
                      {senderName[0]?.toUpperCase()}
                    </div>
                  )}
                </Link>

                {/* Recommendation Card */}
                <div className={`flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                  {!isOwn && (
                    <Link
                      to={`/profile/${msg.sender?._id || msg.sender}`}
                      className="text-xs text-base-content/50 px-1 hover:text-primary transition-colors font-medium"
                    >
                      {senderName}
                    </Link>
                  )}
                  <RecommendationCard message={msg} />
                  <span className="text-xs text-base-content/30 px-1">{time}</span>
                </div>
              </div>
            );
          }

          if (msg.type === 'analysis_share') {
            return (
              <div
                key={msg._id ?? idx}
                className={`flex items-start gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <Link
                  to={isOwn ? "/profile" : `/profile/${msg.sender?._id || msg.sender}`}
                  className="avatar flex-shrink-0 mt-0.5 hover:opacity-80 transition-opacity"
                >
                  {avatar ? (
                    <div className="w-8 rounded-full">
                      <img src={avatar} alt={senderName} />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral flex items-center justify-center text-xs font-bold text-neutral-content">
                      {senderName[0]?.toUpperCase()}
                    </div>
                  )}
                </Link>

                <div className={`flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                  {!isOwn && (
                    <Link
                      to={`/profile/${msg.sender?._id || msg.sender}`}
                      className="text-xs text-base-content/50 px-1 hover:text-primary transition-colors font-medium"
                    >
                      {senderName}
                    </Link>
                  )}
                  
                  <div className={`p-4 rounded-2xl flex flex-col gap-2 max-w-sm border border-base-300 shadow-sm ${
                    isOwn
                      ? 'bg-primary/10 text-base-content rounded-br-sm'
                      : 'bg-base-200 text-base-content rounded-bl-sm'
                  }`}>
                    <p className="text-sm font-medium">
                      {msg.analysisData?.type === 'profile'
                        ? isOwn 
                          ? t("You shared your profile analysis.")
                          : t("{{user}} is sharing their profile analysis with you.", { user: senderName })
                        : isOwn
                          ? t("You shared a CineMatch analysis.")
                          : t("{{user}} shared a CineMatch analysis with you.", { user: senderName })
                      }
                    </p>
                    <button 
                      className="btn btn-primary btn-sm mt-2 w-full"
                      onClick={() => {
                        setSelectedAnalysisData(msg.analysisData);
                        setIsAnalysisModalOpen(true);
                      }}
                    >
                      {t("Click to view")}
                    </button>
                  </div>

                  <span className="text-xs text-base-content/30 px-1">{time}</span>
                </div>
              </div>
            );
          }

          // Regular text messages
          return (
            <div
              key={msg._id ?? idx}
              className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <Link
                to={isOwn ? "/profile" : `/profile/${msg.sender?._id || msg.sender}`}
                className="avatar flex-shrink-0 hover:opacity-80 transition-opacity"
              >
                {avatar ? (
                  <div className="w-8 rounded-full">
                    <img src={avatar} alt={senderName} />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-neutral flex items-center justify-center text-xs font-bold text-neutral-content">
                    {senderName[0]?.toUpperCase()}
                  </div>
                )}
              </Link>

              {/* Bubble */}
              <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                {!isOwn && (
                  <Link
                    to={`/profile/${msg.sender?._id || msg.sender}`}
                    className="text-xs text-base-content/50 px-1 hover:text-primary transition-colors font-medium"
                  >
                    {senderName}
                  </Link>
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
          <div className="relative flex-1">
            <textarea
              className="textarea textarea-bordered w-full resize-none text-sm min-h-[2.5rem] max-h-32"
              placeholder={t("Type a message")}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              type="button"
              className="absolute bottom-2 right-2 btn btn-ghost btn-xs"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              😀
            </button>
            {showEmojiPicker && (
              <div className="absolute bottom-12 right-0 z-50">
                <EmojiPicker
                  onEmojiClick={(emojiObject) => {
                    setInputText(inputText + emojiObject.emoji);
                    setShowEmojiPicker(false);
                  }}
                  theme="dark"
                />
              </div>
            )}
          </div>
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
          {t("Join this group to participate in the chat.")}
        </div>
      )}

      {/* Analysis Modal for viewing shared analysis */}
      <AnalyzeModal 
        isOpen={isAnalysisModalOpen} 
        onClose={() => setIsAnalysisModalOpen(false)} 
        data={selectedAnalysisData} 
      />
    </div>
  );
}
