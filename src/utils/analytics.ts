import type {
  DailyOpRecord,
  DashboardFilters,
  DepartmentTargetRecord,
  HospitalDatasetBundle,
  PatientEncounterRecord,
  StaffRosterRecord,
  UnderstaffedAlert,
} from '../types/hospital';
import { generateForecast } from './forecasting';

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export interface DepartmentSummaryRow {
  department: string;
  daysLogged: number;
  totalAdmitted: number;
  totalHandled: number;
  avgDailyHandled: number;
  avgWaitMinutes: number;
  avgOccupancyPct: number;
  peakOccupancyPct: number;
  spikeDays90Plus: number;
  avgPatientToStaffRatio: number;
  avgStaffOnDuty: number;
  targetShiftStaff: number;
  totalRosteredStaff: number;
  totalBeds: number;
  overtimeHours: number;
  avgEfficiencyScore: number;
  understaffedDays: number;
  patientRecordsCount: number;
  readmissionRatePct: number;
  avgSatisfaction: number | null;
}

export interface HeatmapCell {
  day: string;
  hour: number;
  count: number;
  avgWait: number;
}

export interface ComputedAnalytics {
  filteredDaily: DailyOpRecord[];
  filteredPatients: PatientEncounterRecord[];
  filteredStaff: StaffRosterRecord[];
  kpis: {
    totalHandled: number;
    totalAdmitted: number;
    totalDischarged: number;
    avgDailyHandled: number;
    avgWaitMinutes: number;
    medianPatientWaitMinutes: number | null;
    avgOccupancyPct: number;
    avgOccupiedBedsPerDay: number;
    totalBedCapacity: number;
    spikeDaysCount: number;
    totalOvertimeHours: number;
    estimatedOvertimeCostNgn: number;
    avgPatientToStaffRatio: number;
    avgEfficiencyScore: number;
    understaffedShiftCount: number;
    readmissionRatePct: number;
    avgSatisfactionScore: number | null;
    avgTreatmentCostNgn: number | null;
  };
  dailyTrend: Array<{
    date: string;
    label: string;
    admitted: number;
    handled: number;
    avgWait: number;
    occupancyPct: number;
    staffOnDuty: number;
    patientToStaffRatio: number;
    efficiencyScore: number;
    isSpike: boolean;
  }>;
  departmentSummaries: DepartmentSummaryRow[];
  heatmap: {
    cells: HeatmapCell[];
    maxCount: number;
    peakSlot: HeatmapCell | null;
  };
  understaffedAlerts: UnderstaffedAlert[];
  staffBreakdown: {
    byRole: Array<{ role: string; count: number; avgExp: number }>;
    byEmployment: Array<{ type: string; count: number; pct: number }>;
    totalRostered: number;
  };
  diagnosisBreakdown: Array<{ diagnosis: string; count: number; avgCost: number; readmitPct: number }>;
  narrativeInsights: Array<{ title: string; detail: string; category: string }>;
}

export function filterDataset(bundle: HospitalDatasetBundle, filters: DashboardFilters) {
  const { department, startDate, endDate } = filters;
  const filteredDaily = bundle.dailyOps.filter((d) => {
    if (department !== 'All' && d.department !== department) return false;
    if (startDate && d.date < startDate) return false;
    if (endDate && d.date > endDate) return false;
    return true;
  });

  const filteredPatients = bundle.patients.filter((p) => {
    if (department !== 'All' && p.department !== department) return false;
    if (startDate && p.arrivalDate < startDate) return false;
    if (endDate && p.arrivalDate > endDate) return false;
    return true;
  });

  const filteredStaff =
    department === 'All'
      ? bundle.staff
      : bundle.staff.filter((s) => s.department === department);

  return { filteredDaily, filteredPatients, filteredStaff };
}

function getMedian(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
}

export function computeAnalytics(
  bundle: HospitalDatasetBundle,
  filters: DashboardFilters,
  overtimeHourlyRateNgn = 4500
): ComputedAnalytics {
  const { filteredDaily, filteredPatients, filteredStaff } = filterDataset(bundle, filters);

  const targetMap = new Map<string, DepartmentTargetRecord>();
  for (const t of bundle.targets) {
    targetMap.set(t.department, t);
  }

  // Daily trend aggregation
  const byDate = new Map<
    string,
    {
      admitted: number;
      discharged: number;
      handled: number;
      waitSum: number;
      occSum: number;
      bedsOcc: number;
      bedsTot: number;
      staff: number;
      ratioSum: number;
      effSum: number;
      rows: number;
    }
  >();

  let totalHandled = 0;
  let totalAdmitted = 0;
  let totalDischarged = 0;
  let totalWaitWeighted = 0;
  let totalOvertimeHours = 0;
  let totalRatioSum = 0;
  let totalEffSum = 0;
  let totalBedsOccupiedSum = 0;
  let totalBedsPossibleSum = 0;
  let totalOccRateSum = 0;

  const understaffedAlerts: UnderstaffedAlert[] = [];

  for (const row of filteredDaily) {
    totalHandled += row.patientsHandled;
    totalAdmitted += row.patientsAdmitted;
    totalDischarged += row.patientsDischarged;
    totalWaitWeighted += row.avgWaitTimeMinutes;
    totalOvertimeHours += row.overtimeHoursLogged;
    totalRatioSum += row.patientToStaffRatio;
    totalEffSum += row.operationalEfficiencyScore;
    totalBedsOccupiedSum += row.bedsOccupied;
    totalBedsPossibleSum += row.bedsOccupied + row.bedsAvailable;
    totalOccRateSum += row.bedOccupancyRate;

    const cur = byDate.get(row.date) || {
      admitted: 0,
      discharged: 0,
      handled: 0,
      waitSum: 0,
      occSum: 0,
      bedsOcc: 0,
      bedsTot: 0,
      staff: 0,
      ratioSum: 0,
      effSum: 0,
      rows: 0,
    };
    cur.admitted += row.patientsAdmitted;
    cur.discharged += row.patientsDischarged;
    cur.handled += row.patientsHandled;
    cur.waitSum += row.avgWaitTimeMinutes;
    cur.occSum += row.bedOccupancyRate;
    cur.bedsOcc += row.bedsOccupied;
    cur.bedsTot += row.bedsOccupied + row.bedsAvailable;
    cur.staff += row.totalStaffOnDuty;
    cur.ratioSum += row.patientToStaffRatio;
    cur.effSum += row.operationalEfficiencyScore;
    cur.rows += 1;
    byDate.set(row.date, cur);

    // Check understaffing vs Department Targets
    const target = targetMap.get(row.department);
    if (target && row.totalStaffOnDuty > 0) {
      const docDef = Math.max(0, target.doctorsPerShiftTarget - row.doctorsOnDuty);
      const nurseDef = Math.max(0, target.nursesPerShiftTarget - row.nursesOnDuty);
      const supDef = Math.max(0, target.supportStaffPerShiftTarget - row.supportStaffOnDuty);
      const totalDeficit = docDef + nurseDef + supDef;
      if (totalDeficit >= 2 || (totalDeficit >= 1 && (row.bedOccupancyRate >= 90 || row.patientToStaffRatio >= 1.15))) {
        understaffedAlerts.push({
          date: row.date,
          department: row.department,
          doctorsOnDuty: row.doctorsOnDuty,
          doctorsTarget: target.doctorsPerShiftTarget,
          nursesOnDuty: row.nursesOnDuty,
          nursesTarget: target.nursesPerShiftTarget,
          supportOnDuty: row.supportStaffOnDuty,
          supportTarget: target.supportStaffPerShiftTarget,
          totalDeficit,
          patientToStaffRatio: row.patientToStaffRatio,
          bedOccupancyRate: row.bedOccupancyRate,
          avgWaitTimeMinutes: row.avgWaitTimeMinutes,
          severity: totalDeficit >= 3 || row.bedOccupancyRate >= 95 ? 'Critical' : 'Elevated',
        });
      }
    }
  }

  understaffedAlerts.sort((a, b) => b.totalDeficit - a.totalDeficit || b.bedOccupancyRate - a.bedOccupancyRate || b.date.localeCompare(a.date));

  const sortedDates = Array.from(byDate.keys()).sort();
  let spikeDaysCount = 0;
  const dailyTrend = sortedDates.map((date) => {
    const d = byDate.get(date)!;
    const occPct = d.bedsTot > 0 ? (d.bedsOcc / d.bedsTot) * 100 : d.occSum / Math.max(1, d.rows);
    const isSpike = occPct >= 90;
    if (isSpike) spikeDaysCount++;
    const dt = new Date(`${date}T00:00:00Z`);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      date,
      label: `${months[dt.getUTCMonth()]} ${dt.getUTCDate()}`,
      admitted: d.admitted,
      handled: d.handled,
      avgWait: Number((d.waitSum / Math.max(1, d.rows)).toFixed(1)),
      occupancyPct: Number(occPct.toFixed(1)),
      staffOnDuty: d.staff,
      patientToStaffRatio: Number((d.ratioSum / Math.max(1, d.rows)).toFixed(2)),
      efficiencyScore: Number((d.effSum / Math.max(1, d.rows)).toFixed(1)),
      isSpike,
    };
  });

  // Patient encounter stats
  const patientWaits = filteredPatients.map((p) => p.waitTimeMinutes).filter((v): v is number => v !== null);
  const patientSats = filteredPatients.map((p) => p.patientSatisfactionScore).filter((v): v is number => v !== null);
  const patientCosts = filteredPatients.map((p) => p.treatmentCostNgn).filter((v): v is number => v !== null);
  const readmitCount = filteredPatients.filter((p) => p.readmittedWithin30Days).length;

  const avgOccupancyPct =
    totalBedsPossibleSum > 0
      ? Number(((totalBedsOccupiedSum / totalBedsPossibleSum) * 100).toFixed(1))
      : filteredDaily.length > 0
      ? Number((totalOccRateSum / filteredDaily.length).toFixed(1))
      : 0;

  const totalBedCapacity =
    filters.department === 'All'
      ? bundle.targets.reduce((s, t) => s + t.totalBeds, 0)
      : targetMap.get(filters.department)?.totalBeds ?? 0;

  // Department breakdown
  const deptGroups = new Map<string, DailyOpRecord[]>();
  for (const r of filteredDaily) {
    const arr = deptGroups.get(r.department) || [];
    arr.push(r);
    deptGroups.set(r.department, arr);
  }

  const patientsByDept = new Map<string, PatientEncounterRecord[]>();
  for (const p of filteredPatients) {
    const arr = patientsByDept.get(p.department) || [];
    arr.push(p);
    patientsByDept.set(p.department, arr);
  }

  const departmentSummaries: DepartmentSummaryRow[] = Array.from(deptGroups.entries())
    .map(([dept, rows]) => {
      const target = targetMap.get(dept);
      const pList = patientsByDept.get(dept) || [];
      const deptReadmits = pList.filter((p) => p.readmittedWithin30Days).length;
      const deptSats = pList.map((p) => p.patientSatisfactionScore).filter((v): v is number => v !== null);

      const totHandled = rows.reduce((s, r) => s + r.patientsHandled, 0);
      const totAdmitted = rows.reduce((s, r) => s + r.patientsAdmitted, 0);
      const avgWait = rows.reduce((s, r) => s + r.avgWaitTimeMinutes, 0) / rows.length;
      const avgOcc = rows.reduce((s, r) => s + r.bedOccupancyRate, 0) / rows.length;
      const peakOcc = Math.max(...rows.map((r) => r.bedOccupancyRate));
      const spikeDays90Plus = rows.filter((r) => r.bedOccupancyRate >= 90).length;
      const avgRatio = rows.reduce((s, r) => s + r.patientToStaffRatio, 0) / rows.length;
      const avgStaff = rows.reduce((s, r) => s + r.totalStaffOnDuty, 0) / rows.length;
      const otHours = rows.reduce((s, r) => s + r.overtimeHoursLogged, 0);
      const avgEff = rows.reduce((s, r) => s + r.operationalEfficiencyScore, 0) / rows.length;
      const underDays = understaffedAlerts.filter((a) => a.department === dept).length;

      return {
        department: dept,
        daysLogged: rows.length,
        totalAdmitted: totAdmitted,
        totalHandled: totHandled,
        avgDailyHandled: Number((totHandled / rows.length).toFixed(1)),
        avgWaitMinutes: Number(avgWait.toFixed(1)),
        avgOccupancyPct: Number(avgOcc.toFixed(1)),
        peakOccupancyPct: Number(peakOcc.toFixed(1)),
        spikeDays90Plus,
        avgPatientToStaffRatio: Number(avgRatio.toFixed(2)),
        avgStaffOnDuty: Number(avgStaff.toFixed(1)),
        targetShiftStaff: target?.totalShiftTarget ?? 0,
        totalRosteredStaff: target?.totalRosteredStaff ?? 0,
        totalBeds: target?.totalBeds ?? 0,
        overtimeHours: Number(otHours.toFixed(1)),
        avgEfficiencyScore: Number(avgEff.toFixed(1)),
        understaffedDays: underDays,
        patientRecordsCount: pList.length,
        readmissionRatePct: pList.length > 0 ? Number(((deptReadmits / pList.length) * 100).toFixed(1)) : 0,
        avgSatisfaction: deptSats.length > 0 ? Number((deptSats.reduce((a, b) => a + b, 0) / deptSats.length).toFixed(2)) : null,
      };
    })
    .sort((a, b) => b.totalHandled - a.totalHandled);

  // Day-of-Week x Hour Heatmap from Patient Encounters
  const slotMap = new Map<string, { count: number; waitSum: number; waitCnt: number }>();
  for (const p of filteredPatients) {
    if (p.arrivalHour === null) continue;
    const day = DAYS_ORDER.includes(p.dayOfWeek) ? p.dayOfWeek : 'Monday';
    const key = `${day}__${p.arrivalHour}`;
    const cur = slotMap.get(key) || { count: 0, waitSum: 0, waitCnt: 0 };
    cur.count += 1;
    if (p.waitTimeMinutes !== null) {
      cur.waitSum += p.waitTimeMinutes;
      cur.waitCnt += 1;
    }
    slotMap.set(key, cur);
  }

  const cells: HeatmapCell[] = [];
  let maxCount = 0;
  let peakSlot: HeatmapCell | null = null;
  for (const day of DAYS_ORDER) {
    for (let hour = 0; hour < 24; hour++) {
      const s = slotMap.get(`${day}__${hour}`);
      const count = s?.count ?? 0;
      const avgWait = s && s.waitCnt > 0 ? Number((s.waitSum / s.waitCnt).toFixed(1)) : 0;
      const cell = { day, hour, count, avgWait };
      cells.push(cell);
      if (count > maxCount) {
        maxCount = count;
        peakSlot = cell;
      }
    }
  }

  // Staff Roster Breakdown
  const roleMap = new Map<string, { count: number; expSum: number; expCnt: number }>();
  const empMap = new Map<string, number>();
  for (const s of filteredStaff) {
    const r = roleMap.get(s.role) || { count: 0, expSum: 0, expCnt: 0 };
    r.count += 1;
    if (s.yearsExperience !== null) {
      r.expSum += s.yearsExperience;
      r.expCnt += 1;
    }
    roleMap.set(s.role, r);
    empMap.set(s.employmentType, (empMap.get(s.employmentType) || 0) + 1);
  }

  const byRole = Array.from(roleMap.entries()).map(([role, v]) => ({
    role,
    count: v.count,
    avgExp: v.expCnt > 0 ? Number((v.expSum / v.expCnt).toFixed(1)) : 0,
  }));
  const byEmployment = Array.from(empMap.entries()).map(([type, count]) => ({
    type,
    count,
    pct: filteredStaff.length > 0 ? Number(((count / filteredStaff.length) * 100).toFixed(1)) : 0,
  }));

  // Diagnosis breakdown
  const diagMap = new Map<string, { count: number; costSum: number; costCnt: number; readmit: number }>();
  for (const p of filteredPatients) {
    const cur = diagMap.get(p.diagnosisCategory) || { count: 0, costSum: 0, costCnt: 0, readmit: 0 };
    cur.count += 1;
    if (p.treatmentCostNgn !== null) {
      cur.costSum += p.treatmentCostNgn;
      cur.costCnt += 1;
    }
    if (p.readmittedWithin30Days) cur.readmit += 1;
    diagMap.set(p.diagnosisCategory, cur);
  }
  const diagnosisBreakdown = Array.from(diagMap.entries())
    .map(([diagnosis, v]) => ({
      diagnosis,
      count: v.count,
      avgCost: v.costCnt > 0 ? Math.round(v.costSum / v.costCnt) : 0,
      readmitPct: v.count > 0 ? Number(((v.readmit / v.count) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Executive Narrative Insights
  const narrativeInsights: Array<{ title: string; detail: string; category: string }> = [];
  if (departmentSummaries.length > 0) {
    const highestWaitDept = [...departmentSummaries].sort((a, b) => b.avgWaitMinutes - a.avgWaitMinutes)[0];
    const lowestWaitDept = [...departmentSummaries].sort((a, b) => a.avgWaitMinutes - b.avgWaitMinutes)[0];
    const highestRatioDept = [...departmentSummaries].sort((a, b) => b.avgPatientToStaffRatio - a.avgPatientToStaffRatio)[0];
    const highestOccDept = [...departmentSummaries].sort((a, b) => b.avgOccupancyPct - a.avgOccupancyPct)[0];

    narrativeInsights.push({
      category: 'Wait Time Concentration',
      title: `${highestWaitDept.department} carries the longest average wait (${highestWaitDept.avgWaitMinutes} min)`,
      detail: `Average wait in ${highestWaitDept.department} exceeds ${lowestWaitDept.department} (${lowestWaitDept.avgWaitMinutes} min) by ${(highestWaitDept.avgWaitMinutes - lowestWaitDept.avgWaitMinutes).toFixed(1)} minutes across ${highestWaitDept.daysLogged} logged days.`,
    });

    if (peakSlot && peakSlot.count > 0) {
      const hrStr = `${String(peakSlot.hour).padStart(2, '0')}:00–${String((peakSlot.hour + 1) % 24).padStart(2, '0')}:00`;
      narrativeInsights.push({
        category: 'Arrival Peak Window',
        title: `Peak intake demand concentrates on ${peakSlot.day}s at ${hrStr}`,
        detail: `${peakSlot.count} patient encounters arrived in this window with an average clinician wait of ${peakSlot.avgWait} minutes. Staggering triage shifts ahead of ${String(peakSlot.hour).padStart(2, '0')}:00 reduces backlog.`,
      });
    }

    narrativeInsights.push({
      category: 'Staffing & Bottlenecks',
      title: `${understaffedAlerts.length} understaffed shift instances detected; ${highestRatioDept.department} leads patient-to-staff ratio (${highestRatioDept.avgPatientToStaffRatio}:1)`,
      detail: `${highestOccDept.department} averaged ${highestOccDept.avgOccupancyPct}% bed occupancy (${highestOccDept.spikeDays90Plus} days ≥90%), while logged overtime totals ${totalOvertimeHours.toFixed(1)} hrs across the filtered period.`,
    });

    if (filteredPatients.length > 0) {
      const readmitPct = Number(((readmitCount / filteredPatients.length) * 100).toFixed(1));
      const satAvg =
        patientSats.length > 0
          ? Number((patientSats.reduce((a, b) => a + b, 0) / patientSats.length).toFixed(2))
          : null;
      narrativeInsights.push({
        category: 'Clinical Outcomes',
        title: `30-day readmission rate stands at ${readmitPct}% across ${filteredPatients.length.toLocaleString()} patient records`,
        detail: `${satAvg !== null ? `Mean patient satisfaction is ${satAvg}/5.0` : 'Patient satisfaction data active'}${patientCosts.length > 0 ? ` with average episode treatment cost of ₦${Math.round(patientCosts.reduce((a, b) => a + b, 0) / patientCosts.length).toLocaleString()}` : ''}.`,
      });
    }
  }

  return {
    filteredDaily,
    filteredPatients,
    filteredStaff,
    kpis: {
      totalHandled,
      totalAdmitted,
      totalDischarged,
      avgDailyHandled: sortedDates.length > 0 ? Number((totalHandled / sortedDates.length).toFixed(1)) : 0,
      avgWaitMinutes: filteredDaily.length > 0 ? Number((totalWaitWeighted / filteredDaily.length).toFixed(1)) : 0,
      medianPatientWaitMinutes: getMedian(patientWaits),
      avgOccupancyPct,
      avgOccupiedBedsPerDay: sortedDates.length > 0 ? Number((totalBedsOccupiedSum / sortedDates.length).toFixed(1)) : 0,
      totalBedCapacity,
      spikeDaysCount,
      totalOvertimeHours: Number(totalOvertimeHours.toFixed(1)),
      estimatedOvertimeCostNgn: Math.round(totalOvertimeHours * overtimeHourlyRateNgn),
      avgPatientToStaffRatio: filteredDaily.length > 0 ? Number((totalRatioSum / filteredDaily.length).toFixed(2)) : 0,
      avgEfficiencyScore: filteredDaily.length > 0 ? Number((totalEffSum / filteredDaily.length).toFixed(1)) : 0,
      understaffedShiftCount: understaffedAlerts.length,
      readmissionRatePct: filteredPatients.length > 0 ? Number(((readmitCount / filteredPatients.length) * 100).toFixed(1)) : 0,
      avgSatisfactionScore:
        patientSats.length > 0
          ? Number((patientSats.reduce((a, b) => a + b, 0) / patientSats.length).toFixed(2))
          : null,
      avgTreatmentCostNgn:
        patientCosts.length > 0
          ? Math.round(patientCosts.reduce((a, b) => a + b, 0) / patientCosts.length)
          : null,
    },
    dailyTrend,
    departmentSummaries,
    heatmap: { cells, maxCount, peakSlot },
    understaffedAlerts,
    staffBreakdown: {
      byRole,
      byEmployment,
      totalRostered: filteredStaff.length,
    },
    diagnosisBreakdown,
    narrativeInsights,
  };
}

/**
 * Build a complete, exact multi-dimensional JSON snapshot from the loaded datasets
 * so the Gemini AI chatbot answers strictly from computed values without hallucination.
 */
export function buildAiAnalyticsSnapshot(
  bundle: HospitalDatasetBundle,
  filters: DashboardFilters
) {
  const fullFilters: DashboardFilters = {
    department: 'All',
    startDate: bundle.quality.dateRange.min,
    endDate: bundle.quality.dateRange.max,
  };
  const full = computeAnalytics(bundle, fullFilters);
  const filtered = computeAnalytics(bundle, filters);

  // Monthly breakdown across full dataset
  const monthlyMap = new Map<
    string,
    { handled: number; admitted: number; waitSum: number; occSum: number; overtime: number; rows: number }
  >();
  for (const r of bundle.dailyOps) {
    const month = r.date.slice(0, 7);
    const cur = monthlyMap.get(month) || { handled: 0, admitted: 0, waitSum: 0, occSum: 0, overtime: 0, rows: 0 };
    cur.handled += r.patientsHandled;
    cur.admitted += r.patientsAdmitted;
    cur.waitSum += r.avgWaitTimeMinutes;
    cur.occSum += r.bedOccupancyRate;
    cur.overtime += r.overtimeHoursLogged;
    cur.rows += 1;
    monthlyMap.set(month, cur);
  }
  const monthlySummary = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      patientsHandled: v.handled,
      patientsAdmitted: v.admitted,
      avgWaitMinutes: Number((v.waitSum / v.rows).toFixed(1)),
      avgOccupancyPct: Number((v.occSum / v.rows).toFixed(1)),
      overtimeHoursLogged: Number(v.overtime.toFixed(1)),
    }));

  // Monthly by department (for questions like "which department had longest wait last month?")
  const deptMonthMap = new Map<string, { waitSum: number; occSum: number; handled: number; ot: number; rows: number }>();
  for (const r of bundle.dailyOps) {
    const key = `${r.date.slice(0, 7)}__${r.department}`;
    const cur = deptMonthMap.get(key) || { waitSum: 0, occSum: 0, handled: 0, ot: 0, rows: 0 };
    cur.waitSum += r.avgWaitTimeMinutes;
    cur.occSum += r.bedOccupancyRate;
    cur.handled += r.patientsHandled;
    cur.ot += r.overtimeHoursLogged;
    cur.rows += 1;
    deptMonthMap.set(key, cur);
  }
  const latestMonth = monthlySummary[monthlySummary.length - 1]?.month;
  const latestMonthByDept = latestMonth
    ? bundle.quality.departments.map((dept) => {
        const v = deptMonthMap.get(`${latestMonth}__${dept}`);
        return v
          ? {
              department: dept,
              month: latestMonth,
              patientsHandled: v.handled,
              avgWaitMinutes: Number((v.waitSum / v.rows).toFixed(1)),
              avgOccupancyPct: Number((v.occSum / v.rows).toFixed(1)),
              overtimeHours: Number(v.ot.toFixed(1)),
            }
          : null;
      }).filter(Boolean)
    : [];

  // Pre-compute 14-day forecast summaries for the active department
  const demandForecast14 = generateForecast(bundle.dailyOps, bundle.targets, filters.department, 'demand', 14);
  const occupancyForecast14 = generateForecast(bundle.dailyOps, bundle.targets, filters.department, 'occupancy', 14);
  const staffingForecast14 = generateForecast(bundle.dailyOps, bundle.targets, filters.department, 'staffing', 14);

  return {
    dataScope: {
      sourceMode: bundle.quality.sourceMode,
      sourceLabel: bundle.quality.sourceLabel,
      dailyOpsRows: bundle.quality.dailyRowsParsed,
      patientEncountersRows: bundle.quality.patientRowsParsed,
      departmentTargetRows: bundle.quality.targetRowsParsed,
      staffRosterRows: bundle.quality.staffRowsParsed,
      fullDateRange: bundle.quality.dateRange,
      activeFilters: filters,
      availableColumns: {
        dailyOps: bundle.files.dailyOps?.headers ?? [],
        targets: bundle.files.targets?.headers ?? [],
        patients: bundle.files.patients?.headers ?? [],
        staff: bundle.files.staff?.headers ?? [],
      },
    },
    activeFilterKpis: filtered.kpis,
    fullDatasetKpis: full.kpis,
    departmentSummariesFullYear: full.departmentSummaries,
    latestMonthByDepartment: latestMonthByDept,
    monthlyTrend: monthlySummary,
    peakArrivalWindow: full.heatmap.peakSlot,
    topUnderstaffedAlerts: full.understaffedAlerts.slice(0, 12),
    diagnosisBreakdown: full.diagnosisBreakdown,
    staffBreakdown: full.staffBreakdown,
    forecast14DaySummary: {
      department: filters.department,
      demand: {
        projectedAvgDailyPatients: demandForecast14.projectedAvg,
        projectedPeak: demandForecast14.projectedPeak,
        recommendedShiftStaffAvg: demandForecast14.recommendedShiftStaffAvg,
        rmse: demandForecast14.rmse,
      },
      occupancy: {
        projectedAvgPct: occupancyForecast14.projectedAvg,
        projectedPeak: occupancyForecast14.projectedPeak,
        rmse: occupancyForecast14.rmse,
      },
      staffing: {
        projectedAvgStaff: staffingForecast14.projectedAvg,
        recommendedShiftStaffAvg: staffingForecast14.recommendedShiftStaffAvg,
      },
    },
  };
}
