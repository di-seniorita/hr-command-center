import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { checkAiHealth, fetchChatbotFaq, sendChatbotMessage } from "../api";

function ChatbotPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [faqItems, setFaqItems] = useState([]);
  const [faqLoaded, setFaqLoaded] = useState(false);
  const [isLlmConnected, setIsLlmConnected] = useState(false);
  const [isCheckingLlm, setIsCheckingLlm] = useState(false);
  const chatScrollRef = useRef(null);

  const canSend = useMemo(() => inputValue.trim().length > 0 && !isLoading, [inputValue, isLoading]);

  useEffect(() => {
    if (!isOpen || faqLoaded) {
      return;
    }

    const loadInitialData = async () => {
      try {
        const faq = await fetchChatbotFaq();
        setFaqItems(Array.isArray(faq) ? faq : []);
      } catch {
        setFaqItems([]);
      } finally {
        setFaqLoaded(true);
      }

      setIsCheckingLlm(true);
      try {
        const health = await checkAiHealth();
        setIsLlmConnected(health?.status !== "unavailable");
      } catch {
        setIsLlmConnected(false);
      } finally {
        setIsCheckingLlm(false);
      }
    };

    loadInitialData();
  }, [faqLoaded, isOpen]);

  useEffect(() => {
    if (!isOpen || !chatScrollRef.current) {
      return;
    }
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [isOpen, messages, isLoading]);

  const appendUserMessage = (text) => {
    setMessages((prev) => [...prev, { role: "user", text, source: null }]);
  };

  const appendBotMessage = (text, source) => {
    setMessages((prev) => [...prev, { role: "bot", text, source: source || null }]);
  };

  const sendMessage = async (text) => {
    const normalized = text.trim();
    if (!normalized || isLoading) {
      return;
    }

    appendUserMessage(normalized);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await sendChatbotMessage(normalized);
      appendBotMessage(response?.answer || "Не удалось получить ответ.", response?.source || "ai");
    } catch {
      appendBotMessage("Сервис временно недоступен. Попробуйте ещё раз чуть позже.", "ai");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSend) {
      return;
    }
    await sendMessage(inputValue);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg transition hover:bg-indigo-400"
        aria-label={isOpen ? "Закрыть HR помощник" : "Открыть HR помощник"}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      <div
        className={`fixed bottom-20 right-6 z-40 h-[500px] w-[calc(100vw-2rem)] max-w-[380px] rounded-xl border border-gray-700 bg-gray-900 shadow-2xl transition-all duration-300 sm:w-[380px] ${
          isOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-10 opacity-0"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-100">HR Помощник</h3>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isCheckingLlm ? "bg-yellow-400" : isLlmConnected ? "bg-green-400" : "bg-red-400"
                }`}
                title={
                  isCheckingLlm
                    ? "Проверка подключения"
                    : isLlmConnected
                      ? "LLM подключён"
                      : "LLM недоступен"
                }
              />
            </div>
          </div>

          <div className="border-b border-gray-700 px-3 py-2">
            <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1">
              {faqItems.map((item) => (
                <button
                  key={item.question}
                  type="button"
                  onClick={() => sendMessage(item.question)}
                  disabled={isLoading}
                  className="rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-left text-xs text-gray-200 transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {item.question}
                </button>
              ))}
            </div>
          </div>

          <div ref={chatScrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-gray-300">
                Задайте вопрос по отпуску, зарплате, обучению или любому HR-процессу.
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[85%]">
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      message.role === "user"
                        ? "bg-indigo-500 text-white"
                        : "bg-gray-700 text-gray-100"
                    }`}
                  >
                    {message.text}
                  </div>
                  {message.role === "bot" && (
                    <div className="mt-1 text-xs text-gray-400">
                      {message.source === "faq" ? "из базы знаний" : "AI ответ"}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2 text-sm text-gray-100">
                  <Loader2 size={14} className="animate-spin" />
                  Подбираю ответ...
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-gray-700 p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Введите вопрос..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-indigo-500 focus:outline-none"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!canSend}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Отправить сообщение"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export default ChatbotPanel;
