import { useEffect, useMemo, useRef, useState } from "react";
import {
  askNutritionAssistant,
  clearAssistantHistory,
  fetchAssistantHistory,
} from "../services/api";

const INITIAL_MESSAGE = {
  role: "assistant",
  text: "Hola, soy tu asistente nutricional. Puedo ayudarte con macros, calorías, comparaciones entre alimentos y cantidades en gramos.",
};

export default function AssistantPage() {
  const currentUser = JSON.parse(localStorage.getItem("bf_current_user") || "null");
  const userId = currentUser?.id;
  const userName = currentUser?.nombre || "Usuario";

  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");
  const chatScrollRef = useRef(null);

  const suggestions = useMemo(
    () => [
      "Macros de 150 g de avena",
      "Compara arroz vs quinoa",
      "Qué alimentos tienen menos calorías",
      "Cuáles son los más altos en proteína",
      "Calorías de 200 gramos de plátano",
    ],
    []
  );

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
    });
  }

  useEffect(() => {
    if (!userId) {
      setMessages([INITIAL_MESSAGE]);
      return;
    }

    async function loadHistory() {
      setLoadingHistory(true);
      setError("");

      try {
        const data = await fetchAssistantHistory(userId);
        const historyMessages = (data.items || []).map((item) => ({
          role: item.role,
          text: item.content,
        }));

        setMessages(historyMessages.length > 0 ? historyMessages : [INITIAL_MESSAGE]);
      } catch (err) {
        setError(err.message);
        setMessages([INITIAL_MESSAGE]);
      } finally {
        setLoadingHistory(false);
        scrollToBottom();
      }
    }

    loadHistory();
  }, [userId]);

  async function sendMessage(messageText) {
    const cleaned = messageText.trim();
    if (!cleaned || loading) return;

    setError("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "user", text: cleaned }]);
    setInput("");
    scrollToBottom();

    try {
      const response = await askNutritionAssistant(cleaned, userId);
      setMessages((prev) => [...prev, { role: "assistant", text: response.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    sendMessage(input);
  }

  async function handleClearHistory() {
    if (!userId || loading || loadingHistory) return;

    const confirmed = globalThis.confirm("¿Quieres borrar el historial del asistente?");
    if (!confirmed) return;

    setLoading(true);
    setError("");

    try {
      await clearAssistantHistory(userId);
      setMessages([INITIAL_MESSAGE]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  }

  return (
    <div className="page assistant-page">
      <div className="page-header assistant-header">
        <div>
          <h2>Asistente IA Nutricional</h2>
          <p>Pregunta por calorías, macros, comparaciones y cantidades concretas.</p>
        </div>

        <div className="assistant-user-pill">
          <span className="assistant-user-dot" />
          <strong>{userName}</strong>
        </div>
      </div>

      <section className="assistant-hero card">
        <div className="assistant-hero-copy">
          <h3>Tu asistente nutricional personal</h3>
          <p>
            Pregunta cosas como “macros de 150 g de arroz”, “compara pollo vs salmón”
            o “qué alimentos tienen menos calorías”.
          </p>
        </div>

        <button
          type="button"
          className="assistant-clear-button"
          onClick={handleClearHistory}
          disabled={!userId || loading || loadingHistory}
        >
          Limpiar historial
        </button>
      </section>

      <div className="assistant-shell card">
        <div className="assistant-chat" ref={chatScrollRef}>
          {loadingHistory ? <div className="assistant-typing">Cargando historial...</div> : null}

          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`assistant-row assistant-row-${message.role}`}
            >
              <div className={`assistant-bubble assistant-bubble-${message.role}`}>
                {message.text.split("\n").map((line, lineIndex) => (
                  <p key={`${index}-line-${lineIndex}`}>{line}</p>
                ))}
              </div>
            </div>
          ))}

          {loading ? <div className="assistant-typing">Pensando respuesta...</div> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </div>

        <div className="assistant-suggestions">
          {suggestions.map((item) => (
            <button
              key={item}
              type="button"
              className="assistant-suggestion-chip"
              onClick={() => sendMessage(item)}
              disabled={loading}
            >
              {item}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="assistant-form">
          <input
            type="text"
            placeholder="Ej. macros de 150 g de avena"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}>
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
}