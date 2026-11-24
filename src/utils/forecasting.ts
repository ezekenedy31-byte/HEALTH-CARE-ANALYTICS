import type {
  DailyOpRecord,
  DepartmentTargetRecord,
  ForecastMetric,
  ForecastPoint,
  ForecastResult,
} from '../types/hospital';

function addDaysIso(isoDate: string, days: number): string {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function getShortDayLabel(isoDate: string): string {
  const dt = new Date(`${isoDate}T00:00:00Z`);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[dt.getUTCMonth()]} ${dt.getUTCDate()}`;
}

export function generateForecast(
  dailyOps: DailyOpRecord[],
  targets: DepartmentTargetRecord[],
  department: string,
  metric: ForecastMetric,
  horizonDays: number
): ForecastResult {
  const clampedHorizon = Math.max(7, Math.min(30, Math.round(horizonDays || 14)));
  const scoped = department === 'All' ? dailyOps : dailyOps.filter((d) => d.department === department);

  // Target shift staffing benchmark
  const targetShiftTotal =
    department === 'All'
      ? targets.reduce((s, t) => s + t.totalShiftTarget, 0)
      : targets.find((t) => t.department === department)?.totalShiftTarget ?? 0;

  // Group chronologically by date
  const byDate = new Map<
    string,
    {
      handled: number;
      admitted: number;
      occSum: number;
      bedsOccupied: number;
      bedsTotal: number;
      staffOnDuty: number;
      count: number;
    }
  >();

  for (const row of scoped) {
    const cur = byDate.get(row.date) || {
      handled: 0,
      admitted: 0,
      occSum: 0,
      bedsOccupied: 0,
      bedsTotal: 0,
      staffOnDuty: 0,
      count: 0,
    };
    cur.handled += row.patientsHandled;
    cur.admitted += row.patientsAdmitted;
    cur.occSum += row.bedOccupancyRate;
    cur.bedsOccupied += row.bedsOccupied;
    cur.bedsTotal += row.bedsOccupied + row.bedsAvailable;
    cur.staffOnDuty += row.totalStaffOnDuty;
    cur.count += 1;
    byDate.set(row.date, cur);
  }

  const sortedDates = Array.from(byDate.keys()).sort();
  if (sortedDates.length === 0) {
    return {
      metric,
      metricLabel: metric === 'demand' ? 'Patient Demand' : metric === 'occupancy' ? 'Bed Occupancy' : 'Required Staffing',
      unit: metric === 'occupancy' ? '%' : metric === 'staffing' ? 'staff' : 'patients',
      horizonDays: clampedHorizon,
      department,
      points: [],
      modelName: 'Damped Holt Trend + Day-of-Week Seasonality',
      mae: 0,
      rmse: 0,
      trendSlopePerWeek: 0,
      projectedAvg: 0,
      projectedPeak: { date: '', value: 0 },
      recommendedShiftStaffAvg: 0,
      notes: 'Insufficient historical observations for forecasting.',
    };
  }

  // Historical target patient-to-staff ratio for staffing requirement estimation
  const ratioSamples = scoped.filter((r) => r.totalStaffOnDuty > 0 && r.patientsHandled > 0);
  const avgObservedRatio =
    ratioSamples.length > 0
      ? ratioSamples.reduce((s, r) => s + r.patientsHandled / r.totalStaffOnDuty, 0) / ratioSamples.length
      : 1.0;
  // Safe operational ratio ceiling (cap at 0.95 or observed mean, whichever ensures safe staffing)
  const targetRatio = Math.min(0.95, Math.max(0.65, avgObservedRatio));

  const series = sortedDates.map((date) => {
    const agg = byDate.get(date)!;
    let value = 0;
    if (metric === 'demand') {
      value = agg.handled;
    } else if (metric === 'occupancy') {
      value = agg.bedsTotal > 0 ? (agg.bedsOccupied / agg.bedsTotal) * 100 : agg.occSum / Math.max(1, agg.count);
    } else {
      // Staffing need derived from demand divided by safe ratio (if staff data exists), else actual staff
      value = agg.staffOnDuty > 0 ? agg.staffOnDuty : Math.round(agg.handled / targetRatio);
    }
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { date, dow, value, handled: agg.handled, staffOnDuty: agg.staffOnDuty };
  });

  // Compute Day-of-Week multiplicative seasonal indices
  const overallMean = series.reduce((s, p) => s + p.value, 0) / series.length || 1;
  const dowSums = Array(7).fill(0);
  const dowCounts = Array(7).fill(0);
  for (const pt of series) {
    dowSums[pt.dow] += pt.value;
    dowCounts[pt.dow] += 1;
  }
  const dowIndex = dowSums.map((sum, idx) => {
    if (dowCounts[idx] === 0) return 1;
    const raw = sum / dowCounts[idx] / overallMean;
    return Math.max(0.65, Math.min(1.4, raw));
  });

  // Deseasonalized series for Holt's damped linear trend smoothing
  const deseasonalized = series.map((p) => p.value / dowIndex[p.dow]);

  const alpha = 0.26;
  const beta = 0.1;
  const phi = 0.88;

  let level = deseasonalized[0];
  let trend =
    deseasonalized.length >= 14
      ? (deseasonalized.slice(7, 14).reduce((a, b) => a + b, 0) -
          deseasonalized.slice(0, 7).reduce((a, b) => a + b, 0)) /
        49
      : 0;

  const residuals: number[] = [];
  for (let i = 0; i < series.length; i++) {
    const predSeason = (level + phi * trend) * dowIndex[series[i].dow];
    if (i > 6) {
      residuals.push(series[i].value - predSeason);
    }
    const prevLevel = level;
    level = alpha * deseasonalized[i] + (1 - alpha) * (level + phi * trend);
    trend = beta * (level - prevLevel) + (1 - beta) * phi * trend;
  }

  const rmse =
    residuals.length > 0
      ? Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / residuals.length)
      : Math.max(1, overallMean * 0.08);
  const mae =
    residuals.length > 0
      ? residuals.reduce((s, r) => s + Math.abs(r), 0) / residuals.length
      : rmse * 0.8;

  // Show trailing 42 historical days + N future forecast days
  const windowStart = Math.max(0, series.length - 42);
  const points: ForecastPoint[] = [];

  for (let i = windowStart; i < series.length; i++) {
    const p = series[i];
    const isLast = i === series.length - 1;
    const rounded = Number(p.value.toFixed(1));
    points.push({
      date: p.date,
      dayLabel: getShortDayLabel(p.date),
      actual: rounded,
      forecast: isLast ? rounded : null,
      lowerBound: isLast ? rounded : null,
      upperBound: isLast ? rounded : null,
      rosteredTarget: metric === 'staffing' && targetShiftTotal > 0 ? targetShiftTotal : null,
      isForecast: false,
    });
  }

  // Also compute demand forecast if metric is staffing so we estimate recommended staff from forecasted demand
  const lastDate = series[series.length - 1].date;
  let dampedSum = 0;
  let projTotal = 0;
  let peak = { date: '', value: -Infinity };

  for (let h = 1; h <= clampedHorizon; h++) {
    dampedSum += Math.pow(phi, h);
    const futureDate = addDaysIso(lastDate, h);
    const futureDow = new Date(`${futureDate}T00:00:00Z`).getUTCDay();
    const rawForecast = (level + dampedSum * trend) * dowIndex[futureDow];
    const margin = 1.96 * rmse * Math.sqrt(1 + 0.06 * (h - 1));

    let clampedForecast = Math.max(0, rawForecast);
    let lower = Math.max(0, clampedForecast - margin);
    let upper = clampedForecast + margin;

    if (metric === 'occupancy') {
      clampedForecast = Math.min(100, clampedForecast);
      lower = Math.max(0, Math.min(100, lower));
      upper = Math.min(100, upper);
    }

    const valRounded = Number(clampedForecast.toFixed(1));
    projTotal += valRounded;
    if (valRounded > peak.value) {
      peak = { date: futureDate, value: valRounded };
    }

    points.push({
      date: futureDate,
      dayLabel: getShortDayLabel(futureDate),
      actual: null,
      forecast: valRounded,
      lowerBound: Number(lower.toFixed(1)),
      upperBound: Number(upper.toFixed(1)),
      rosteredTarget: metric === 'staffing' && targetShiftTotal > 0 ? targetShiftTotal : null,
      isForecast: true,
    });
  }

  const projectedAvg = Number((projTotal / clampedHorizon).toFixed(1));

  // Estimate recommended shift staff for demand/staffing
  let recommendedShiftStaffAvg = targetShiftTotal;
  if (metric === 'demand') {
    recommendedShiftStaffAvg = Math.max(1, Math.ceil(projectedAvg / targetRatio));
  } else if (metric === 'staffing') {
    // Also estimate demand-driven staff need if demand > capacity
    recommendedShiftStaffAvg = Math.max(targetShiftTotal, Math.ceil(projectedAvg));
  }

  const metricLabel =
    metric === 'demand'
      ? 'Daily Patient Demand (Handled)'
      : metric === 'occupancy'
      ? 'Bed Occupancy Rate'
      : 'Shift Staffing Level';
  const unit = metric === 'occupancy' ? '%' : metric === 'staffing' ? 'staff/day' : 'patients/day';

  const trendSlopePerWeek = Number((trend * 7).toFixed(2));
  const directionWord =
    Math.abs(trendSlopePerWeek) < 0.25 ? 'stable' : trendSlopePerWeek > 0 ? 'upward' : 'downward';

  return {
    metric,
    metricLabel,
    unit,
    horizonDays: clampedHorizon,
    department,
    points,
    modelName: 'Damped Holt Exponential Smoothing + Day-of-Week Seasonality (95% CI)',
    mae: Number(mae.toFixed(1)),
    rmse: Number(rmse.toFixed(1)),
    trendSlopePerWeek,
    projectedAvg,
    projectedPeak: { date: peak.date, value: Number(peak.value.toFixed(1)) },
    recommendedShiftStaffAvg,
    notes: `Projected ${directionWord} trajectory (${trendSlopePerWeek >= 0 ? '+' : ''}${trendSlopePerWeek} ${unit}/week) based on ${series.length} historical days for ${department === 'All' ? 'all departments' : department}. Estimates include day-of-week seasonality and expanding 95% confidence bounds.`,
  };
}
