import { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, BedDouble, LineChart as LineChartIcon, Search, TrendingUp } from 'lucide-react';
import type { ComputedAnalytics } from '../utils/analytics';
import type {
  DepartmentTargetRecord,
  DailyOpRecord,
  ForecastMetric,
} from '../types/hospital';
import { generateForecast } from '../utils/forecasting';
import { AlternatingKpiCard, SectionHeader } from './SectionHeader';

interface BottlenecksForecastingViewProps {
  analytics: ComputedAnalytics;
  dailyOps: DailyOpRecord[];
  targets: DepartmentTargetRecord[];
  selectedDepartment: string;
  forecastHorizon: number;
  forecastMetric: ForecastMetric;
  onChangeHorizon: (days: number) => void;
  onChangeMetric: (metric: ForecastMetric) => void;
}

export function BottlenecksForecastingView({
  analytics,
  dailyOps,
  targets,
  selectedDepartment,
  forecastHorizon,
  forecastMetric,
  onChangeHorizon,
  onChangeMetric,
}: BottlenecksForecastingViewProps) {
  const [alertSearch, setAlertSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'All' | 'Critical' | 'Elevated'>('All');

  const { kpis, dailyTrend, understaffedAlerts } = analytics;

  const forecast = useMemo(
    () => generateForecast(dailyOps, targets, selectedDepartment, forecastMetric, forecastHorizon),
    [dailyOps, targets, selectedDepartment, forecastMetric, forecastHorizon]
  );

  // Prepare occupancy chart data with explicit spike markers (>= 90%)
  const occupancySeries = useMemo(() => {
    const source = dailyTrend.length > 120 ? dailyTrend.slice(-120) : dailyTrend;
    return source.map((d) => ({
      ...d,
      spikeMarker: d.occupancyPct >= 90 ? d.occupancyPct : null,
    }));
  }, [dailyTrend]);

  // Build stacked interval helper for Recharts confidence band
  const forecastChartData = useMemo(() => {
    return forecast.points.map((p) => ({
      ...p,
      ciRange:
        p.lowerBound !== null && p.upperBound !== null
          ? [p.lowerBound, p.upperBound]
          : null,
    }));
  }, [forecast.points]);

  const filteredAlerts = useMemo(() => {
    const q = alertSearch.trim().toLowerCase();
    return understaffedAlerts.filter((a) => {
      if (severityFilter !== 'All' && a.severity !== severityFilter) return false;
      if (q && !a.department.toLowerCase().includes(q) && !a.date.includes(q)) return false;
      return true;
    });
  }, [understaffedAlerts, alertSearch, severityFilter]);

  const criticalCount = understaffedAlerts.filter((a) => a.severity === 'Critical').length;

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="03 · Risk &amp; Projections"
        title="Bottlenecks &amp; Forecasting"
        subtitle="Identify bed saturation spikes, understaffed shift bottlenecks, and explainable short-term resource projections."
      />

      {/* 4 Alternating KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <AlternatingKpiCard
          index={0}
          icon={<BedDouble className="w-5 h-5" />}
          title="Bed Saturation Spikes (≥90%)"
          value={kpis.spikeDaysCount.toLocaleString()}
          description={`Days reaching ≥90% occupancy · Mean occupancy: ${kpis.avgOccupancyPct}%`}
        />
        <AlternatingKpiCard
          index={1}
          icon={<AlertTriangle className="w-5 h-5" />}
          title="Understaffed Shift Alerts"
          value={understaffedAlerts.length.toLocaleString()}
          description={`${criticalCount} critical shortfalls (deficit ≥3 staff or ≥95% bed occupancy)`}
        />
        <AlternatingKpiCard
          index={2}
          icon={<TrendingUp className="w-5 h-5" />}
          title={`${forecast.horizonDays}-Day Projected Avg`}
          value={`${forecast.projectedAvg} ${forecast.metric === 'occupancy' ? '%' : forecast.metric === 'staffing' ? 'staff' : 'pts/d'}`}
          description={`Projected estimate · Peak ${forecast.projectedPeak.value} on ${forecast.projectedPeak.date || '—'}`}
        />
        <AlternatingKpiCard
          index={3}
          icon={<LineChartIcon className="w-5 h-5" />}
          title="Recommended Shift Staffing"
          value={`${forecast.recommendedShiftStaffAvg} staff/day`}
          description={`Estimated shift capacity required for ${selectedDepartment === 'All' ? 'all units' : selectedDepartment} over next ${forecast.horizonDays} days`}
        />
      </div>

      {/* Interactive Explainable Forecast Chart */}
      <div className="border border-[#0A2E36]/20 rounded-[6px] p-5 sm:p-6 bg-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-[#0A2E36]/12">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="font-serif text-xl font-bold text-[#1B1B2F]">
                {forecast.horizonDays}-Day Operational Forecast — {forecast.metricLabel}
              </h3>
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#02808F]">
                Projected Estimate
              </span>
            </div>
            <p className="text-xs italic text-[#6B7280] mt-1">
              {forecast.notes}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Metric selector */}
            <div className="inline-flex rounded-[6px] border border-[#0A2E36]/20 overflow-hidden text-xs font-semibold">
              {(
                [
                  { id: 'demand', label: 'Demand' },
                  { id: 'occupancy', label: 'Bed Occ %' },
                  { id: 'staffing', label: 'Staffing' },
                ] as const
              ).map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => onChangeMetric(m.id)}
                  className={`px-3 py-1.5 cursor-pointer transition-colors ${
                    forecastMetric === m.id
                      ? 'bg-[#0A2E36] text-white'
                      : 'bg-white text-[#1B1B2F] hover:bg-[#02808F]/10'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Horizon slider */}
            <div className="flex items-center gap-2.5 bg-[#0A2E36]/[0.04] px-3 py-1.5 rounded-[6px]">
              <label htmlFor="forecast-horizon" className="text-xs font-semibold text-[#1B1B2F] whitespace-nowrap">
                Horizon: <span className="font-mono text-[#02808F] tabular-nums">{forecastHorizon}d</span>
              </label>
              <input
                id="forecast-horizon"
                type="range"
                min={7}
                max={30}
                step={1}
                value={forecastHorizon}
                onChange={(e) => onChangeHorizon(Number(e.target.value))}
                className="w-24 accent-[#02808F] cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="h-[320px] mt-5">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={forecastChartData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(10, 46, 54, 0.1)" />
              <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: '#6B7280' }} minTickGap={18} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} domain={forecastMetric === 'occupancy' ? [0, 100] : ['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0A2E36',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '12px',
                }}
              />
              {/* 95% confidence band */}
              <Area
                type="monotone"
                dataKey="ciRange"
                name="95% Confidence Band (Est.)"
                stroke="none"
                fill="rgba(0, 167, 149, 0.22)"
                connectNulls={false}
              />
              {/* Historical Actuals */}
              <Line
                type="monotone"
                dataKey="actual"
                name="Historical Actual"
                stroke="#0A2E36"
                strokeWidth={2.2}
                dot={false}
                connectNulls={false}
              />
              {/* Projected Estimate */}
              <Line
                type="monotone"
                dataKey="forecast"
                name="Projected Estimate"
                stroke="#02808F"
                strokeWidth={2.6}
                strokeDasharray="6 4"
                dot={{ r: 2.5, fill: '#00A795' }}
                connectNulls={false}
              />
              {forecastMetric === 'occupancy' && (
                <ReferenceLine
                  y={90}
                  stroke="#0A2E36"
                  strokeDasharray="4 4"
                  label={{ value: '90% Spike Threshold', position: 'insideTopRight', fill: '#0A2E36', fontSize: 11 }}
                />
              )}
              {forecastMetric === 'staffing' && (
                <Line
                  type="monotone"
                  dataKey="rosteredTarget"
                  name="Target Shift Staffing"
                  stroke="#6B7280"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Forecast Diagnostics Footer */}
        <div className="mt-4 pt-3 border-t border-[#0A2E36]/10 flex flex-wrap items-center justify-between gap-3 text-xs text-[#6B7280] font-mono tabular-nums">
          <span>Model: {forecast.modelName}</span>
          <span>
            In-sample MAE: {forecast.mae} · RMSE: {forecast.rmse} · Weekly Slope:{' '}
            {forecast.trendSlopePerWeek >= 0 ? `+${forecast.trendSlopePerWeek}` : forecast.trendSlopePerWeek} {forecast.unit}/wk
          </span>
        </div>
      </div>

      {/* Bed Occupancy Trend with Spike Highlighting */}
      <div className="border border-[#0A2E36]/15 rounded-[6px] p-5 bg-white">
        <div className="mb-4">
          <h3 className="font-serif text-lg font-bold text-[#1B1B2F]">
            Bed Occupancy Trend &amp; Saturation Spikes
          </h3>
          <p className="text-xs italic text-[#6B7280]">
            Trailing occupancy profile highlighting days exceeding the 90% capacity bottleneck threshold
          </p>
        </div>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={occupancySeries} margin={{ top: 10, right: 16, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(10, 46, 54, 0.1)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} minTickGap={22} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} domain={[40, 105]} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0A2E36',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '12px',
                }}
              />
              <ReferenceLine
                y={90}
                stroke="#0A2E36"
                strokeDasharray="4 4"
                label={{ value: '90% Bottleneck Threshold', position: 'insideBottomRight', fill: '#0A2E36', fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="occupancyPct"
                name="Bed Occupancy %"
                stroke="#02808F"
                strokeWidth={2}
                fill="rgba(2, 128, 143, 0.14)"
              />
              <Line
                type="monotone"
                dataKey="spikeMarker"
                name="Spike Day (≥90%)"
                stroke="transparent"
                dot={{ r: 4, fill: '#0A2E36', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Understaffed-Shift Alerts Table */}
      <div className="border border-[#0A2E36]/15 rounded-[6px] bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-[#0A2E36]/12 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#1B1B2F]">
              Understaffed-Shift Bottleneck Alerts
            </h3>
            <p className="text-xs italic text-[#6B7280]">
              Shifts where on-duty doctors, nurses, or support personnel fell short of Department Targets ({filteredAlerts.length.toLocaleString()} matching alerts)
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={alertSearch}
                onChange={(e) => setAlertSearch(e.target.value)}
                placeholder="Filter dept or date..."
                className="pl-8 pr-3 py-1.5 text-xs border border-[#0A2E36]/20 rounded-[6px] text-[#1B1B2F] focus:outline-none focus:border-[#02808F]"
              />
            </div>
            <div className="inline-flex rounded-[6px] border border-[#0A2E36]/20 overflow-hidden text-xs font-semibold">
              {(['All', 'Critical', 'Elevated'] as const).map((sev) => (
                <button
                  type="button"
                  key={sev}
                  onClick={() => setSeverityFilter(sev)}
                  className={`px-2.5 py-1.5 cursor-pointer transition-colors ${
                    severityFilter === sev
                      ? 'bg-[#0A2E36] text-white'
                      : 'bg-white text-[#1B1B2F] hover:bg-[#02808F]/10'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#6B7280]">
            No understaffed shift alerts match your current filter selection.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#0A2E36]/15 bg-[#0A2E36]/[0.03] text-[11px] font-semibold uppercase tracking-wider text-[#1B1B2F]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3">Department</th>
                  <th className="py-3 px-3">Severity</th>
                  <th className="py-3 px-3 text-right">Doctors</th>
                  <th className="py-3 px-3 text-right">Nurses</th>
                  <th className="py-3 px-3 text-right">Support</th>
                  <th className="py-3 px-3 text-right">Deficit</th>
                  <th className="py-3 px-3 text-right">Bed Occ</th>
                  <th className="py-3 px-3 text-right">Pt:Staff</th>
                  <th className="py-3 px-4 text-right">Avg Wait</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0A2E36]/10 text-xs sm:text-sm">
                {filteredAlerts.slice(0, 25).map((a, idx) => (
                  <tr key={`${a.date}-${a.department}-${idx}`} className="hover:bg-[#02808F]/[0.04] transition-colors">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-[#1B1B2F]">{a.date}</td>
                    <td className="py-2.5 px-3 font-semibold text-[#1B1B2F]">{a.department}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-mono text-xs font-semibold ${
                          a.severity === 'Critical' ? 'text-[#0A2E36]' : 'text-[#02808F]'
                        }`}
                      >
                        {a.severity}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#6B7280]">
                      {a.doctorsOnDuty}/{a.doctorsTarget}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#6B7280]">
                      {a.nursesOnDuty}/{a.nursesTarget}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#6B7280]">
                      {a.supportOnDuty}/{a.supportTarget}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#0A2E36]">
                      -{a.totalDeficit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#02808F] font-semibold">
                      {a.bedOccupancyRate}%
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#1B1B2F]">
                      {a.patientToStaffRatio}:1
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#1B1B2F]">
                      {a.avgWaitTimeMinutes}m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredAlerts.length > 25 && (
              <div className="px-4 py-2.5 bg-[#0A2E36]/[0.02] border-t border-[#0A2E36]/10 text-xs text-[#6B7280] font-mono">
                Showing top 25 of {filteredAlerts.length.toLocaleString()} flagged shift alerts sorted by staff deficit &amp; bed load.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
