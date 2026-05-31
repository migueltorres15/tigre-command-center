'use client';

import { useEffect, useRef } from 'react';

const MESES_S = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const CHART_DEFAULTS = {
  font: { family: 'DM Sans, system-ui, sans-serif', size: 11 },
  color: '#555',
  grid: 'rgba(255,255,255,0.04)',
  tooltip: {
    backgroundColor: '#1A1A1A',
    borderColor: '#2E2E2E',
    borderWidth: 1,
    titleColor: '#F0F0F0',
    bodyColor: '#888',
    padding: 10,
  },
};

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 });
}

/* ─── Ingresos vs Meta (últimos 6 meses) ─── */
export function ChartIngresos({ data, meta }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!data?.length || !ref.current) return;
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      if (chartRef.current) chartRef.current.destroy();

      const labels = data.map(d => {
        const [y, m] = d.mes.split('-');
        return `${MESES_S[parseInt(m) - 1]} ${y.slice(2)}`;
      });
      const valores = data.map(d => d.total);

      chartRef.current = new Chart(ref.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Ingresos',
              data: valores,
              backgroundColor: valores.map(v =>
                v >= meta ? 'rgba(16,185,129,0.7)' : 'rgba(124,58,237,0.65)'
              ),
              borderColor: valores.map(v => v >= meta ? '#10B981' : '#7C3AED'),
              borderWidth: 1,
              borderRadius: 6,
              borderSkipped: false,
            },
            {
              label: `Meta (${fmt(meta)})`,
              data: Array(data.length).fill(meta),
              type: 'line',
              borderColor: '#F59E0B',
              borderWidth: 2,
              borderDash: [6, 4],
              pointRadius: 0,
              fill: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#666', font: CHART_DEFAULTS.font, boxWidth: 12, padding: 12 } },
            tooltip: {
              ...CHART_DEFAULTS.tooltip,
              callbacks: { label: c => ` ${c.dataset.label}: ${fmt(c.parsed.y)}` },
            },
          },
          scales: {
            x: { ticks: { color: '#555', font: CHART_DEFAULTS.font }, grid: { color: CHART_DEFAULTS.grid } },
            y: {
              ticks: { color: '#555', font: CHART_DEFAULTS.font, callback: v => fmt(v) },
              grid: { color: CHART_DEFAULTS.grid },
            },
          },
        },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data, meta]);

  return <canvas ref={ref} />;
}

/* ─── Deudas: pagado vs pendiente ─── */
export function ChartDeudas({ pagada, pendiente }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      if (chartRef.current) chartRef.current.destroy();

      chartRef.current = new Chart(ref.current, {
        type: 'doughnut',
        data: {
          labels: ['Pendiente', 'Pagado'],
          datasets: [{
            data: [pendiente || 0, pagada || 0],
            backgroundColor: ['rgba(239,68,68,0.75)', 'rgba(16,185,129,0.75)'],
            borderColor: ['#EF4444', '#10B981'],
            borderWidth: 1,
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#666', font: CHART_DEFAULTS.font, padding: 12, boxWidth: 12 },
            },
            tooltip: {
              ...CHART_DEFAULTS.tooltip,
              callbacks: { label: c => ` ${c.label}: ${fmt(c.parsed)}` },
            },
          },
        },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [pagada, pendiente]);

  return <canvas ref={ref} />;
}

/* ─── Productividad por proyecto ─── */
export function ChartProductividad({ data }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!data?.length || !ref.current) return;
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      if (chartRef.current) chartRef.current.destroy();

      const labels = data.map(d => d.proyecto);
      chartRef.current = new Chart(ref.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Completadas',
              data: data.map(d => d.completadas),
              backgroundColor: 'rgba(16,185,129,0.65)',
              borderColor: '#10B981',
              borderWidth: 1,
              borderRadius: 5,
              borderSkipped: false,
            },
            {
              label: 'Pendientes',
              data: data.map(d => d.pendientes),
              backgroundColor: 'rgba(239,68,68,0.5)',
              borderColor: '#EF4444',
              borderWidth: 1,
              borderRadius: 5,
              borderSkipped: false,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: '#666', font: CHART_DEFAULTS.font, boxWidth: 12, padding: 12 } },
            tooltip: { ...CHART_DEFAULTS.tooltip },
          },
          scales: {
            x: { ticks: { color: '#555', font: CHART_DEFAULTS.font }, grid: { color: CHART_DEFAULTS.grid }, stacked: false },
            y: {
              ticks: { color: '#555', font: CHART_DEFAULTS.font, stepSize: 1 },
              grid: { color: CHART_DEFAULTS.grid },
              beginAtZero: true,
            },
          },
        },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data]);

  return <canvas ref={ref} />;
}

/* ─── Ingresos por proyecto (donut) ─── */
export function ChartProyectos({ data }) {
  const ref = useRef(null);
  const chartRef = useRef(null);

  const COLORS = ['#7C3AED','#10B981','#3B82F6','#F59E0B','#EC4899','#14B8A6'];

  useEffect(() => {
    if (!data?.length || !ref.current) return;
    import('chart.js').then(({ Chart, registerables }) => {
      Chart.register(...registerables);
      if (chartRef.current) chartRef.current.destroy();

      chartRef.current = new Chart(ref.current, {
        type: 'doughnut',
        data: {
          labels: data.map(d => d.proyecto),
          datasets: [{
            data: data.map(d => d.total),
            backgroundColor: COLORS.map(c => c + 'bb'),
            borderColor: COLORS,
            borderWidth: 1,
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '58%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#666', font: CHART_DEFAULTS.font, padding: 10, boxWidth: 12 },
            },
            tooltip: {
              ...CHART_DEFAULTS.tooltip,
              callbacks: { label: c => ` ${c.label}: ${fmt(c.parsed)}` },
            },
          },
        },
      });
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data]);

  return <canvas ref={ref} />;
}
