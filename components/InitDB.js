'use client';

import { useEffect } from 'react';

export default function InitDB() {
  useEffect(() => {
    fetch('/api/init').catch(() => {});
  }, []);
  return null;
}
