import { useState, useEffect } from 'react';

export function useSeasons() {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/seasons')
      .then(r => r.json())
      .then(d => { setSeasons(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  return { seasons, loading };
}

export function useMatches(season) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!season) return;
    setLoading(true);
    fetch(`/api/matches?season=${season}`)
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [season]);
  return { data, loading };
}

export function useSummary(season) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!season) return;
    setLoading(true);
    fetch(`/api/matches/summary?season=${season}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [season]);
  return { data, loading };
}

export function usePlayers(season) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!season) return;
    setLoading(true);
    fetch(`/api/players?season=${season}&sort=goals&order=DESC`)
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [season]);
  return { data, loading };
}

