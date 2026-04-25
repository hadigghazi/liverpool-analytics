import { useState, useRef, useEffect } from 'react';
import styles from './AIChatbot.module.css';

export default function AIChatbot() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Ask me anything about Liverpool's 2024-25 season — form, tactics, player stats, goals...",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      const { reply } = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      setHistory((prev) =>
        [...prev, { role: 'user', content: text }, { role: 'assistant', content: reply }].slice(
          -12
        )
      );
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
    }
    setLoading(false);
  };

  const suggestions = [
    "How's Liverpool's away form?",
    'Top scorer this season?',
    'Last 5 match results?',
    'Goals scored vs xG?',
  ];

  return (
    <div className={styles.chatbot}>
      <h2 className={styles.heading}>AI Analyst</h2>
      <div className={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} className={`${styles.msg} ${styles[m.role]}`}>
            {m.role === 'assistant' && <span className={styles.avatar}>⚽</span>}
            <span className={styles.bubble}>{m.content}</span>
          </div>
        ))}
        {loading && (
          <div className={`${styles.msg} ${styles.assistant}`}>
            <span className={styles.avatar}>⚽</span>
            <span className={styles.bubble}>
              <span className={styles.dots}>
                <span />
                <span />
                <span />
              </span>
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && (
        <div className={styles.suggestions}>
          {suggestions.map((s) => (
            <button key={s} className={styles.suggestion} onClick={() => setInput(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className={styles.inputRow}>
        <input
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about Liverpool..."
          disabled={loading}
        />
        <button className={styles.send} onClick={send} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
