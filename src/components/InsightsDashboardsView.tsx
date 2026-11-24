import { Activity, BedDouble, Clock, Download, FileText, Printer, Users } from 'lucide-react';
import type { ComputedAnalytics } from '../utils/analytics';
import type { DashboardFilters, DataQualityReport } from '../types/hospital';
import { AlternatingKpiCard, SectionHeader } from './SectionHeader';

interface InsightsDashboardsViewProps {
  analytics: ComputedAnalytics;
  filters: DashboardFilters;
  quality: DataQualityReport;
  overtimeRateNgn: number;
  onChangeOvertimeRate: (rate: number) => void;
}

export function InsightsDashboardsView({
  analytics,
  filters,
  quality,
  overtimeRateNgn,
  onChangeOvertimeRate,
}: InsightsDashboardsViewProps) {
  const { kpis, departmentSummaries, narrativeInsights, diagnosisBreakdown } = analytics;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const headers = [
      'Department',
      'DaysLogged',
      'PatientsAdmitted',
      'PatientsHandled',
      'AvgDailyHandled',
      'AvgWaitMinutes',
      'AvgBedOccupancyPct',
      'SpikeDays90Plus',
      'AvgPatientToStaffRatio',
      'AvgStaffOnDuty',
      'TargetShiftStaff',
      'OvertimeHoursLogged',
      'AvgEfficiencyScore',
      'UnderstaffedShiftDays',
    ];
    const rows = departmentSummaries.map((d) =>
      [
        d.department,
        d.daysLogged,
        d.totalAdmitted,
        d.totalHandled,
        d.avgDailyHandled,
        d.avgWaitMinutes,
        d.avgOccupancyPct,
        d.spikeDays90Plus,
        d.avgPatientToStaffRatio,
        d.avgStaffOnDuty,
        d.targetShiftStaff,
        d.overtimeHours,
        d.avgEfficiencyScore,
        d.understaffedDays,
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hospital_executive_summary_${filters.startDate}_${filters.endDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportBrief = () => {
    const lines = [
      `MERIDIAN HOSPITAL OPERATIONS — EXECUTIVE BRIEF`,
      `Scope: ${filters.department === 'All' ? 'All Departments' : filters.department} | ${filters.startDate} to ${filters.endDate}`,
      `Records Analyzed: ${analytics.filteredDaily.length.toLocaleString()} daily logs, ${analytics.filteredPatients.length.toLocaleString()} patient encounters`,
      ``,
      `KEY PERFORMANCE INDICATORS`,
      `- Total Patients Handled: ${kpis.totalHandled.toLocaleString()} (${kpis.totalAdmitted.toLocaleString()} inpatient admissions)`,
      `- Average Wait Time: ${kpis.avgWaitMinutes} min (Patient median: ${kpis.medianPatientWaitMinutes ?? 'N/A'} min)`,
      `- Bed Occupancy Rate: ${kpis.avgOccupancyPct}% (${kpis.spikeDaysCount} facility-wide days >= 90%)`,
      `- Logged Overtime: ${kpis.totalOvertimeHours.toFixed(1)} hrs (Est. cost: ₦${kpis.estimatedOvertimeCostNgn.toLocaleString()} @ ₦${overtimeRateNgn.toLocaleString()}/hr)`,
      `- Understaffed Shift Instances: ${kpis.understaffedShiftCount}`,
      ``,
      `AUTO-GENERATED OPERATIONAL INSIGHTS`,
      ...narrativeInsights.map((ins, i) => `${i + 1}. [${ins.category}] ${ins.title} — ${ins.detail}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `executive_brief_${filters.startDate}_${filters.endDate}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="04 · Executive Summary"
        title="Insights &amp; Dashboards"
        subtitle="Hospital-wide operational performance, leadership takeaways, and print-ready departmental scorecards."
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[6px] border border-[#0A2E36]/20 text-[#1B1B2F] hover:border-[#02808F] hover:text-[#02808F] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={handleExportBrief}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[6px] border border-[#0A2E36]/20 text-[#1B1B2F] hover:border-[#02808F] hover:text-[#02808F] transition-colors whitespace-nowrap cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              Export Brief
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[6px] bg-[#0A2E36] text-white hover:bg-[#02808F] transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Summary
            </button>
          </div>
        }
      />

      {/* 4 Alternating Teal KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <AlternatingKpiCard
          index={0}
          icon={<Activity className="w-5 h-5" />}
          title="Total Encounters &amp; Admissions"
          value={kpis.totalHandled.toLocaleString()}
          description={`${kpis.totalAdmitted.toLocaleString()} direct inpatient admissions · ${kpis.avgDailyHandled} patients/day avg`}
        />
        <AlternatingKpiCard
          index={1}
          icon={<Clock className="w-5 h-5" />}
          title="Average Wait Time"
          value={`${kpis.avgWaitMinutes} min`}
          description={
            kpis.medianPatientWaitMinutes !== null
              ? `Patient-level median wait: ${kpis.medianPatientWaitMinutes} min across ${analytics.filteredPatients.length.toLocaleString()} encounters`
              : `Mean clinician wait across ${analytics.filteredDaily.length.toLocaleString()} daily logs`
          }
        />
        <AlternatingKpiCard
          index={2}
          icon={<BedDouble className="w-5 h-5" />}
          title="Bed Occupancy Rate"
          value={`${kpis.avgOccupancyPct}%`}
          description={`${kpis.avgOccupiedBedsPerDay} / ${kpis.totalBedCapacity} beds avg occupied · ${kpis.spikeDaysCount} days ≥90% load`}
        />
        <AlternatingKpiCard
          index={3}
          icon={<Users className="w-5 h-5" />}
          title="Logged Overtime &amp; Cost"
          value={`${kpis.totalOvertimeHours.toFixed(1)} hrs`}
          description={
            kpis.totalOvertimeHours === 0
              ? `₦0 logged overtime · ${kpis.understaffedShiftCount} understaffed shifts detected vs targets`
              : `Est. ₦${kpis.estimatedOvertimeCostNgn.toLocaleString()} at ₦${overtimeRateNgn.toLocaleString()}/hr · ${kpis.understaffedShiftCount} short shifts`
          }
        />
      </div>

      {/* Auto-generated Executive Narrative Insights (Alternating 4-panel grid matching brand) */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h3 className="font-serif text-xl font-bold text-[#1B1B2F]">
              Operational Decision Insights
            </h3>
            <p className="text-xs italic text-[#6B7280] mt-0.5">
              Synthesized directly from {analytics.filteredDaily.length.toLocaleString()} daily logs and {analytics.filteredPatients.length.toLocaleString()} encounter records
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6B7280] no-print">
            <label htmlFor="ot-rate-input" className="whitespace-nowrap">
              Overtime Rate (₦/hr):
            </label>
            <input
              id="ot-rate-input"
              type="number"
              min={0}
              step={500}
              value={overtimeRateNgn}
              onChange={(e) => onChangeOvertimeRate(Math.max(0, Number(e.target.value) || 0))}
              className="w-24 px-2 py-1 text-xs font-mono tabular-nums border border-[#0A2E36]/20 rounded-[4px] text-[#1B1B2F] focus:outline-none focus:border-[#02808F]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {narrativeInsights.map((insight, idx) => {
            const panelColor = idx % 2 === 0 ? 'bg-[#02808F]' : 'bg-[#00A795]';
            return (
              <div
                key={insight.title}
                className={`${panelColor} rounded-[6px] p-5 text-white print-break-avoid`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-[#0A2E36] text-white flex items-center justify-center text-xs font-mono font-semibold shrink-0">
                    0{idx + 1}
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/90">
                    {insight.category}
                  </span>
                </div>
                <h4 className="text-base font-bold text-white leading-snug">
                  {insight.title}
                </h4>
                <p className="text-xs sm:text-sm text-white/90 mt-2 leading-relaxed">
                  {insight.detail}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Department Performance Scorecard Table */}
      <div className="border border-[#0A2E36]/15 rounded-[6px] bg-white overflow-hidden print-break-avoid">
        <div className="px-6 py-4 border-b border-[#0A2E36]/12 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#1B1B2F]">
              Department Performance Scorecard
            </h3>
            <p className="text-xs italic text-[#6B7280]">
              Comparative throughput, wait times, bed saturation, and shift staffing efficiency
            </p>
          </div>
          <div className="text-xs font-mono text-[#6B7280] tabular-nums">
            {departmentSummaries.length} departments · {kpis.readmissionRatePct}% 30d readmission
            {kpis.avgSatisfactionScore !== null ? ` · ${kpis.avgSatisfactionScore}/5.0 CSAT` : ''}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#0A2E36]/15 bg-[#0A2E36]/[0.03] text-[11px] font-semibold uppercase tracking-wider text-[#1B1B2F]">
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-3 text-right">Handled</th>
                <th className="py-3 px-3 text-right">Admitted</th>
                <th className="py-3 px-3 text-right">Avg Wait</th>
                <th className="py-3 px-3 text-right">Bed Occ %</th>
                <th className="py-3 px-3 text-right">≥90% Days</th>
                <th className="py-3 px-3 text-right">Pt/Staff</th>
                <th className="py-3 px-3 text-right">Avg/Target Staff</th>
                <th className="py-3 px-3 text-right">Efficiency</th>
                <th className="py-3 px-4 text-right">30d Readmit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0A2E36]/10 text-sm">
              {departmentSummaries.map((row) => (
                <tr key={row.department} className="hover:bg-[#02808F]/[0.04] transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-[#1B1B2F]">{row.department}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#1B1B2F]">
                    {row.totalHandled.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#6B7280]">
                    {row.totalAdmitted.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#1B1B2F]">
                    {row.avgWaitMinutes}m
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[#02808F]">
                    {row.avgOccupancyPct}%
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#1B1B2F]">
                    {row.spikeDays90Plus}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#1B1B2F]">
                    {row.avgPatientToStaffRatio}:1
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#6B7280]">
                    {row.avgStaffOnDuty} / {row.targetShiftStaff || '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[#00A795]">
                    {row.avgEfficiencyScore}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-[#6B7280]">
                    {row.readmissionRatePct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Clinical Diagnosis & Data Quality Footer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print-break-avoid">
        <div className="border border-[#0A2E36]/15 rounded-[6px] p-5 bg-white">
          <h3 className="font-serif text-lg font-bold text-[#1B1B2F]">
            Top Clinical Diagnosis Categories
          </h3>
          <p className="text-xs italic text-[#6B7280] mt-0.5 mb-4">
            Volume, average episode treatment cost (NGN), and 30-day readmission share
          </p>
          {diagnosisBreakdown.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No patient encounter diagnosis records in active selection.</p>
          ) : (
            <div className="divide-y divide-[#0A2E36]/10">
              {diagnosisBreakdown.map((item) => (
                <div key={item.diagnosis} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium text-[#1B1B2F]">{item.diagnosis}</span>
                  <div className="flex items-center gap-4 font-mono text-xs tabular-nums text-[#6B7280]">
                    <span className="text-[#1B1B2F] font-semibold">{item.count} cases</span>
                    <span>₦{item.avgCost.toLocaleString()}</span>
                    <span>{item.readmitPct}% readmit</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-[#0A2E36]/15 rounded-[6px] p-5 bg-white">
          <h3 className="font-serif text-lg font-bold text-[#1B1B2F]">
            Dataset Integrity &amp; Coverage Note
          </h3>
          <p className="text-xs italic text-[#6B7280] mt-0.5 mb-4">
            Automated schema audit across {quality.sourceLabel}
          </p>
          <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
            <div className="p-3 rounded-[4px] bg-[#0A2E36]/[0.03] border border-[#0A2E36]/10">
              <div className="text-[#6B7280]">Daily Ops Parsed</div>
              <div className="text-base font-mono font-bold text-[#1B1B2F] tabular-nums mt-0.5">
                {quality.dailyRowsParsed.toLocaleString()}
              </div>
            </div>
            <div className="p-3 rounded-[4px] bg-[#0A2E36]/[0.03] border border-[#0A2E36]/10">
              <div className="text-[#6B7280]">Patient Encounters</div>
              <div className="text-base font-mono font-bold text-[#1B1B2F] tabular-nums mt-0.5">
                {quality.patientRowsParsed.toLocaleString()}
              </div>
            </div>
          </div>
          <ul className="space-y-2 text-xs text-[#6B7280]">
            {quality.issues.map((issue, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-mono font-semibold text-[#02808F] shrink-0">[{issue.dataset}]</span>
                <span>
                  {issue.message} ({issue.count.toLocaleString()} rows)
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
