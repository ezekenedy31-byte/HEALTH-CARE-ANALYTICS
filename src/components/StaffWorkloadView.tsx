import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Award, Clock, ShieldCheck, UserCheck } from 'lucide-react';
import type { ComputedAnalytics } from '../utils/analytics';
import { AlternatingKpiCard, SectionHeader } from './SectionHeader';

interface StaffWorkloadViewProps {
  analytics: ComputedAnalytics;
}

export function StaffWorkloadView({ analytics }: StaffWorkloadViewProps) {
  const { kpis, dailyTrend, departmentSummaries, staffBreakdown } = analytics;

  const trendBuckets = useMemo(() => {
    if (dailyTrend.length <= 45) return dailyTrend;
    const out: Array<{
      label: string;
      patientToStaffRatio: number;
      staffOnDuty: number;
      handled: number;
      efficiencyScore: number;
    }> = [];
    for (let i = 0; i < dailyTrend.length; i += 7) {
      const slice = dailyTrend.slice(i, i + 7);
      out.push({
        label: slice[0].label,
        patientToStaffRatio: Number(
          (slice.reduce((s, d) => s + d.patientToStaffRatio, 0) / slice.length).toFixed(2)
        ),
        staffOnDuty: Math.round(slice.reduce((s, d) => s + d.staffOnDuty, 0) / slice.length),
        handled: Math.round(slice.reduce((s, d) => s + d.handled, 0) / slice.length),
        efficiencyScore: Number(
          (slice.reduce((s, d) => s + d.efficiencyScore, 0) / slice.length).toFixed(1)
        ),
      });
    }
    return out;
  }, [dailyTrend]);

  const deptStaffChart = useMemo(
    () =>
      departmentSummaries.map((d) => ({
        department: d.department,
        overtimeHours: d.overtimeHours,
        avgStaffOnDuty: d.avgStaffOnDuty,
        targetShiftStaff: d.targetShiftStaff,
        shiftGap: Number(Math.max(0, d.targetShiftStaff - d.avgStaffOnDuty).toFixed(1)),
      })),
    [departmentSummaries]
  );

  const highestEffDept = [...departmentSummaries].sort((a, b) => b.avgEfficiencyScore - a.avgEfficiencyScore)[0];
  const highestRatioDept = [...departmentSummaries].sort((a, b) => b.avgPatientToStaffRatio - a.avgPatientToStaffRatio)[0];

  return (
    <div className="space-y-10">
      <SectionHeader
        eyebrow="02 · Workforce Capacity"
        title="Staff Workload &amp; Efficiency"
        subtitle="Evaluate patient-to-staff ratios, logged overtime, daily shift coverage against roster targets, and clinical efficiency."
      />

      {/* 4 Alternating Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <AlternatingKpiCard
          index={0}
          icon={<UserCheck className="w-5 h-5" />}
          title="Avg Patient-to-Staff Ratio"
          value={`${kpis.avgPatientToStaffRatio}:1`}
          description={
            highestRatioDept
              ? `Highest load: ${highestRatioDept.department} at ${highestRatioDept.avgPatientToStaffRatio}:1`
              : 'Across active shift logs'
          }
        />
        <AlternatingKpiCard
          index={1}
          icon={<Clock className="w-5 h-5" />}
          title="Overtime Hours Logged"
          value={`${kpis.totalOvertimeHours.toFixed(1)} hrs`}
          description={
            kpis.totalOvertimeHours === 0
              ? `0.0 hrs logged in daily sheet · ${kpis.understaffedShiftCount} shifts fell below target headcount`
              : `Est. ₦${kpis.estimatedOvertimeCostNgn.toLocaleString()} across filtered period`
          }
        />
        <AlternatingKpiCard
          index={2}
          icon={<Award className="w-5 h-5" />}
          title="Operational Efficiency"
          value={`${kpis.avgEfficiencyScore} / 100`}
          description={
            highestEffDept
              ? `Top performing unit: ${highestEffDept.department} (${highestEffDept.avgEfficiencyScore})`
              : 'Composite wait, staffing & utilization index'
          }
        />
        <AlternatingKpiCard
          index={3}
          icon={<ShieldCheck className="w-5 h-5" />}
          title="Active Rostered Staff"
          value={staffBreakdown.totalRostered.toLocaleString()}
          description={
            staffBreakdown.byRole.length > 0
              ? staffBreakdown.byRole.map((r) => `${r.count} ${r.role}s`).join(' · ')
              : 'No roster CSV loaded'
          }
        />
      </div>

      {/* Patient-to-Staff Ratio Trend & Staffing vs Demand Overlay */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-[#0A2E36]/15 rounded-[6px] p-5 bg-white">
          <div className="mb-4">
            <h3 className="font-serif text-lg font-bold text-[#1B1B2F]">
              Patient-to-Staff Ratio Trend
            </h3>
            <p className="text-xs italic text-[#6B7280]">
              Daily or weekly average ratio of patients handled per clinician/support staff member on duty
            </p>
          </div>
          <div className="h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendBuckets} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(10, 46, 54, 0.1)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} minTickGap={22} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} domain={['auto', 'auto']} />
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
                  dataKey="patientToStaffRatio"
                  name="Patient:Staff Ratio"
                  stroke="#02808F"
                  strokeWidth={2.4}
                  dot={false}
                  activeDot={{ r: 5, fill: '#0A2E36' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border border-[#0A2E36]/15 rounded-[6px] p-5 bg-white">
          <div className="mb-4">
            <h3 className="font-serif text-lg font-bold text-[#1B1B2F]">
              Staffing vs. Patient Demand Overlay
            </h3>
            <p className="text-xs italic text-[#6B7280]">
              Average daily staff on duty (bars) overlaid against patients handled (line)
            </p>
          </div>
          <div className="h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendBuckets} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(10, 46, 54, 0.1)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} minTickGap={22} />
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
                <Bar dataKey="staffOnDuty" name="Avg Staff On Duty" fill="#00A795" radius={[3, 3, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="handled"
                  name="Avg Patients Handled"
                  stroke="#0A2E36"
                  strokeWidth={2.4}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Overtime Hours & Shift Target Coverage by Department */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 border border-[#0A2E36]/15 rounded-[6px] p-5 bg-white">
          <div className="mb-4">
            <h3 className="font-serif text-lg font-bold text-[#1B1B2F]">
              On-Duty Shift Coverage vs. Target &amp; Logged Overtime
            </h3>
            <p className="text-xs italic text-[#6B7280]">
              Compares average staff on duty against rostered shift targets alongside logged overtime hours
            </p>
          </div>
          <div className="h-[290px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptStaffChart} margin={{ top: 8, right: 12, left: -12, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(10, 46, 54, 0.1)" />
                <XAxis
                  dataKey="department"
                  tick={{ fontSize: 10, fill: '#1B1B2F' }}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                />
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
                <Bar dataKey="avgStaffOnDuty" name="Avg Staff On Duty" fill="#02808F" radius={[3, 3, 0, 0]} />
                <Bar dataKey="targetShiftStaff" name="Target Shift Staff" fill="#0A2E36" radius={[3, 3, 0, 0]} />
                <Bar dataKey="overtimeHours" name="Overtime Hours Logged" fill="#00A795" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 border border-[#0A2E36]/15 rounded-[6px] p-5 bg-white flex flex-col justify-between">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#1B1B2F]">
              Roster Role &amp; Contract Composition
            </h3>
            <p className="text-xs italic text-[#6B7280] mb-4">
              Clinical experience and employment mix from Staff Roster ({staffBreakdown.totalRostered} personnel)
            </p>

            <div className="space-y-3 mb-6">
              {staffBreakdown.byRole.map((r) => (
                <div key={r.role} className="p-3 rounded-[4px] border border-[#0A2E36]/12 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[#1B1B2F]">{r.role}</div>
                    <div className="text-xs text-[#6B7280] font-mono tabular-nums">
                      Avg {r.avgExp} yrs clinical experience
                    </div>
                  </div>
                  <div className="text-xl font-bold font-mono tabular-nums text-[#02808F]">
                    {r.count}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-[#0A2E36]/12">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#1B1B2F] mb-2.5">
              Employment Contract Mix
            </div>
            <div className="grid grid-cols-3 gap-2">
              {staffBreakdown.byEmployment.map((emp) => (
                <div key={emp.type} className="p-2.5 rounded-[4px] bg-[#0A2E36]/[0.04] text-center">
                  <div className="text-xs text-[#6B7280]">{emp.type}</div>
                  <div className="text-base font-bold font-mono tabular-nums text-[#1B1B2F] mt-0.5">
                    {emp.pct}%
                  </div>
                  <div className="text-[11px] font-mono text-[#02808F] tabular-nums">{emp.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Department Efficiency Scorecards */}
      <div>
        <h3 className="font-serif text-xl font-bold text-[#1B1B2F] mb-1">
          Department Efficiency Scorecards
        </h3>
        <p className="text-xs italic text-[#6B7280] mb-4">
          Alternating departmental efficiency ratings, shift staffing averages, and patient-to-staff ratios
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {departmentSummaries.map((dept, idx) => {
            const bg = idx % 2 === 0 ? 'bg-[#02808F]' : 'bg-[#00A795]';
            return (
              <div key={dept.department} className={`${bg} rounded-[6px] p-4 text-white`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-[#0A2E36] text-white flex items-center justify-center text-xs font-mono font-bold">
                    {dept.department.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-xs font-mono tabular-nums text-white/85">
                    {dept.avgEfficiencyScore}/100
                  </span>
                </div>
                <div className="font-bold text-sm text-white truncate">{dept.department}</div>
                <div className="mt-2 space-y-1 text-xs text-white/90 font-mono tabular-nums">
                  <div className="flex justify-between">
                    <span>Ratio</span>
                    <span>{dept.avgPatientToStaffRatio}:1</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shift Avg</span>
                    <span>
                      {dept.avgStaffOnDuty}/{dept.targetShiftStaff || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Short Days</span>
                    <span>{dept.understaffedDays}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
