import { useState, useRef, useEffect } from 'react';
import styles from './AIChatbot.module.css';

const SUGGESTIONS = [
  "How was Liverpool's away form?",
  'Top scorer this season?',
  'Home vs away goal difference?',
  'Biggest win of the season?',
];

export default function AIChatbot() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Ask me anything about Liverpool's 2024-25 title-winning season." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      });
      const { reply } = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      setHistory(prev => [
        ...prev,
        { role: 'user', content: msg },
        { role: 'assistant', content: reply }
      ].slice(-12));
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error — please try again.' }]);
    }
    setLoading(false);
  };

  return (
    <div className={styles.chatbot}>
      <div className={styles.header}>
        <div className={styles.indicator} />
        <span className={styles.title}>AI Analyst</span>
      </div>

      <div className={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} className={`${styles.msg} ${styles[m.role]}`}>
            <p className={styles.text}>{m.content}</p>
          </div>
        ))}
        {loading && (
          <div className={`${styles.msg} ${styles.assistant}`}>
            <p className={styles.text}>
              <span className={styles.typing}><span/><span/><span/></span>
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && (
        <div className={styles.suggestions}>
          {SUGGESTIONS.map(s => (
            <button key={s} className={styles.suggestion} onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className={styles.inputRow}>
        <input
          className={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Ask about the season..."
          disabled={loading}
        />
        <button
          className={styles.send}
          onClick={() => send()}
          disabled={loading || !input.trim()}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
