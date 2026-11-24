import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarClock, Clock, TrendingUp, Users } from 'lucide-react';
import type { ComputedAnalytics, HeatmapCell } from '../utils/analytics';
import { AlternatingKpiCard, SectionHeader } from './SectionHeader';

interface AdmissionsDemandViewProps {
  analytics: ComputedAnalytics;
}

const DAYS_SHORT = [
  { full: 'Monday', short: 'Mon' },
  { full: 'Tuesday', short: 'Tue' },
  { full: 'Wednesday', short: 'Wed' },
  { full: 'Thursday', short: 'Thu' },
  { full: 'Friday', short: 'Fri' },
  { full: 'Saturday', short: 'Sat' },
  { full: 'Sunday', short: 'Sun' },
];

export function AdmissionsDemandView({ analytics }: AdmissionsDemandViewProps) {
  const [granularity, setGranularity] = useState<'weekly' | 'daily'>('weekly');
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  const { kpis, dailyTrend, departmentSummaries, heatmap } = analytics;

  const timeSeriesData = useMemo(() => {
    if (granularity === 'daily' || dailyTrend.length <= 45) {
      return dailyTrend.map((d) => ({
        date: d.date,
        label: d.label,
        handled: d.handled,
        admitted: d.admitted,
        avgWait: d.avgWait,
      }));
    }
    // Aggregate into weekly buckets for crisp readability over full-year ranges
    const buckets: Array<{
      date: string;
      label: string;
      handled: number;
      admitted: number;
      avgWait: number;
    }> = [];
    for (let i = 0; i < dailyTrend.length; i += 7) {
      const slice = dailyTrend.slice(i, i + 7);
      const handled = slice.reduce((s, d) => s + d.handled, 0);
      const admitted = slice.reduce((s, d) => s + d.admitted, 0);
      const avgWait = Number((slice.reduce((s, d) => s + d.avgWait, 0) / slice.length).toFixed(1));
      buckets.push({
        date: slice[0].date,
        label: slice[0].label,
        handled,
        admitted,
        avgWait,
      });
    }
    return buckets;
  }, [dailyTrend, granularity]);

  const cellLookup = useMemo(() => {
    const m = new Map<string, HeatmapCell>();
    for (const c of heatmap.cells) {
      m.set(`${c.day}__${c.hour}`, c);
    }
    return m;
  }, [heatmap.cells]);

  const getCellStyle = (count: number) => {
    if (count === 0 || heatmap.maxCount === 0) {
      return { backgroundColor: 'rgba(10, 46, 54, 0.04)', color: '#6B7280' };
    }
    const ratio = count / heatmap.maxCount;
    if (ratio >= 0.78) return { backgroundColor: '#0A2E36', color: '#FFFFFF' };
    if (ratio >= 0.52) return { backgroundColor: '#02808F', color: '#FFFFFF' };
    if (ratio >= 0.25) return { backgroundColor: '#00A795', color: '#FFFFFF' };
    return { backgroundColor: 'rgba(0, 167, 149, 0.22)', color: '#1B1B2F' };
  };

  const busiestDept = departmentSummaries[0];
  const longestWaitDept = [...departmentSummaries].sort((a, b) => b.avgWaitMinutes - a.avgWaitMinutes)[0];

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="01 · Volume &amp; Flow"
        title="Admissions, Wait Times &amp; Demand"
        subtitle="Track patient intake trajectories, departmental service demand, clinician wait times, and hourly arrival pressure."
        rightSlot={
          <div className="inline-flex rounded-[6px] border border-[#0A2E36]/20 overflow-hidden text-xs font-semibold">
            <button
              type="button"
              onClick={() => setGranularity('weekly')}
              className={`px-3 py-1.5 cursor-pointer transition-colors ${
                granularity === 'weekly' ? 'bg-[#0A2E36] text-white' : 'bg-white text-[#1B1B2F] hover:bg-[#02808F]/10'
              }`}
            >
              Weekly Trend
            </button>
            <button
              type="button"
              onClick={() => setGranularity('daily')}
              className={`px-3 py-1.5 cursor-pointer transition-colors ${
                granularity === 'daily' ? 'bg-[#0A2E36] text-white' : 'bg-white text-[#1B1B2F] hover:bg-[#02808F]/10'
              }`}
            >
              Daily Detail
            </button>
          </div>
        }
      />

      {/* 4 Alternating Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <AlternatingKpiCard
          index={0}
          icon={<TrendingUp className="w-5 h-5" />}
          title="Total Patients Handled"
          value={kpis.totalHandled.toLocaleString()}
          description={`${kpis.avgDailyHandled} patients/day average · ${kpis.totalDischarged.toLocaleString()} discharges recorded`}
        />
        <AlternatingKpiCard
          index={1}
          icon={<Users className="w-5 h-5" />}
          title="Inpatient Admissions"
          value={kpis.totalAdmitted.toLocaleString()}
          description={
            busiestDept
              ? `Highest volume unit: ${busiestDept.department} (${busiestDept.totalHandled.toLocaleString()} handled)`
              : 'No department breakdown available'
          }
        />
        <AlternatingKpiCard
          index={2}
          icon={<Clock className="w-5 h-5" />}
          title="Mean Wait Time"
          value={`${kpis.avgWaitMinutes} min`}
          description={
            longestWaitDept
              ? `Longest queue: ${longestWaitDept.department} at ${longestWaitDept.avgWaitMinutes} min avg`
              : 'Across selected timeframe'
          }
        />
        <AlternatingKpiCard
          index={3}
          icon={<CalendarClock className="w-5 h-5" />}
          title="Peak Arrival Slot"
          value={
            heatmap.peakSlot
              ? `${heatmap.peakSlot.day.slice(0, 3)} ${String(heatmap.peakSlot.hour).padStart(2, '0')}:00`
              : '—'
          }
          description={
            heatmap.peakSlot
              ? `${heatmap.peakSlot.count} arrivals (${heatmap.peakSlot.avgWait} min avg wait) in peak hour`
              : 'Upload Patient Encounters with ArrivalTime for hourly heatmap'
          }
        />
      </div>

      {/* Charts Row 1: Demand Over Time & Admissions by Department */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 border border-[#0A2E36]/15 rounded-[6px] p-5 bg-white">
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1B1B2F]">
                Service Demand &amp; Admissions Over Time
              </h3>
              <p className="text-xs italic text-[#6B7280]">
                {granularity === 'weekly' && dailyTrend.length > 45 ? 'Weekly totals' : 'Daily counts'} of total patients handled vs direct admissions
              </p>
            </div>
          </div>
          <div className="h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="handledFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#02808F" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#02808F" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="admittedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00A795" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00A795" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(10, 46, 54, 0.1)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0A2E36',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="handled"
                  name="Patients Handled"
                  stroke="#02808F"
                  strokeWidth={2.2}
                  fill="url(#handledFill)"
                />
                <Area
                  type="monotone"
                  dataKey="admitted"
                  name="Patients Admitted"
                  stroke="#00A795"
                  strokeWidth={2}
                  fill="url(#admittedFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 border border-[#0A2E36]/15 rounded-[6px] p-5 bg-white">
          <div className="mb-4">
            <h3 className="font-serif text-lg font-bold text-[#1B1B2F]">
              Volume by Department
            </h3>
            <p className="text-xs italic text-[#6B7280]">
              Total patients handled and inpatient admissions per clinical unit
            </p>
          </div>
          <div className="h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={departmentSummaries}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(10, 46, 54, 0.1)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis
                  type="category"
                  dataKey="department"
                  width={108}
                  tick={{ fontSize: 11, fill: '#1B1B2F', fontWeight: 500 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0A2E36',
                    border: 'none',
                    borderRadius: '6px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="totalHandled" name="Patients Handled" fill="#02808F" radius={[0, 4, 4, 0]} />
                <Bar dataKey="totalAdmitted" name="Admitted" fill="#00A795" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Average Wait Time Trend */}
      <div className="border border-[#0A2E36]/15 rounded-[6px] p-5 bg-white">
        <div className="mb-4">
          <h3 className="font-serif text-lg font-bold text-[#1B1B2F]">
            Average Clinician Wait Time Trend
          </h3>
          <p className="text-xs italic text-[#6B7280]">
            Mean minutes between arrival and clinician evaluation across filtered period
          </p>
        </div>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeSeriesData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(10, 46, 54, 0.1)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} unit="m" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0A2E36',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '12px',
                }}
              />
              <Line
                type="monotone"
                dataKey="avgWait"
                name="Avg Wait (min)"
                stroke="#00A795"
                strokeWidth={2.4}
                dot={false}
                activeDot={{ r: 5, fill: '#0A2E36' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Day-of-Week x Hour Demand Heatmap */}
      <div className="border border-[#0A2E36]/15 rounded-[6px] p-5 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#1B1B2F]">
              Arrival Demand Heatmap (Day of Week &times; Hour of Day)
            </h3>
            <p className="text-xs italic text-[#6B7280]">
              Patient encounter concentration across 24-hour arrival windows ({analytics.filteredPatients.length.toLocaleString()} records)
            </p>
          </div>
          <div className="text-xs font-mono text-[#1B1B2F] tabular-nums bg-[#0A2E36]/[0.04] px-3 py-1.5 rounded-[4px]">
            {hoveredCell
              ? `${hoveredCell.day} ${String(hoveredCell.hour).padStart(2, '0')}:00 — ${hoveredCell.count} arrivals · ${hoveredCell.avgWait}m avg wait`
              : 'Hover any cell to inspect arrivals & wait time'}
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[740px]">
            <div className="grid grid-cols-[60px_repeat(24,minmax(0,1fr))] gap-1 mb-1">
              <div />
              {Array.from({ length: 24 }, (_, hr) => (
                <div key={hr} className="text-[10px] font-mono text-center text-[#6B7280] tabular-nums">
                  {String(hr).padStart(2, '0')}
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {DAYS_SHORT.map((d) => (
                <div key={d.full} className="grid grid-cols-[60px_repeat(24,minmax(0,1fr))] gap-1 items-center">
                  <div className="text-xs font-semibold text-[#1B1B2F] pr-2">{d.short}</div>
                  {Array.from({ length: 24 }, (_, hr) => {
                    const cell = cellLookup.get(`${d.full}__${hr}`) || {
                      day: d.full,
                      hour: hr,
                      count: 0,
                      avgWait: 0,
                    };
                    const style = getCellStyle(cell.count);
                    return (
                      <button
                        type="button"
                        key={hr}
                        onMouseEnter={() => setHoveredCell(cell)}
                        onFocus={() => setHoveredCell(cell)}
                        style={style}
                        className="h-7 rounded-[3px] text-[10px] font-mono tabular-nums flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
                        aria-label={`${d.full} ${hr}:00: ${cell.count} arrivals`}
                      >
                        {cell.count > 0 ? cell.count : ''}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-4 text-[11px] text-[#6B7280]">
          <span>Low</span>
          <span className="w-4 h-3 rounded-[2px] bg-[#00A795]/25 inline-block" />
          <span className="w-4 h-3 rounded-[2px] bg-[#00A795] inline-block" />
          <span className="w-4 h-3 rounded-[2px] bg-[#02808F] inline-block" />
          <span className="w-4 h-3 rounded-[2px] bg-[#0A2E36] inline-block" />
          <span>Peak</span>
        </div>
      </div>
    </div>
  );
}
