export type DatasetRole = 'dailyOps' | 'targets' | 'patients' | 'staff';

export interface DailyOpRecord {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  isWeekend: boolean;
  department: string;
  patientsAdmitted: number;
  patientsDischarged: number;
  patientsHandled: number;
  doctorsOnDuty: number;
  nursesOnDuty: number;
  supportStaffOnDuty: number;
  totalStaffOnDuty: number;
  bedsAvailable: number;
  bedsOccupied: number;
  bedOccupancyRate: number; // 0 - 100+
  patientToStaffRatio: number;
  avgWaitTimeMinutes: number;
  overtimeHoursLogged: number;
  operationalEfficiencyScore: number;
}

export interface DepartmentTargetRecord {
  department: string;
  totalBeds: number;
  doctorsPerShiftTarget: number;
  nursesPerShiftTarget: number;
  supportStaffPerShiftTarget: number;
  totalShiftTarget: number;
  totalRosteredStaff: number;
}

export interface PatientEncounterRecord {
  patientId: string;
  patientName: string;
  age: number | null;
  gender: string;
  department: string;
  attendingPhysician: string;
  arrivalDate: string; // YYYY-MM-DD
  arrivalTime: string; // HH:MM
  arrivalHour: number | null; // 0 - 23
  dayOfWeek: string;
  timeSeenByClinician: string;
  waitTimeMinutes: number | null;
  serviceDurationMinutes: number | null;
  dischargeDate: string;
  lengthOfStayDays: number | null;
  diagnosisCategory: string;
  insuranceType: string;
  treatmentCostNgn: number | null;
  readmittedWithin30Days: boolean;
  patientSatisfactionScore: number | null;
  dischargeStatus: string;
}

export interface StaffRosterRecord {
  staffId: string;
  staffName: string;
  gender: string;
  role: string;
  department: string;
  employmentType: string;
  yearsExperience: number | null;
}

export interface ColumnMappingConfig {
  dailyOps: Record<string, string>;
  targets: Record<string, string>;
  patients: Record<string, string>;
  staff: Record<string, string>;
}

export interface UploadedCsvFile {
  id: string;
  fileName: string;
  role: DatasetRole;
  headers: string[];
  rawRows: Record<string, string>[];
  mapping: Record<string, string>;
  unmappedRequired: string[];
}

export interface DataQualityIssue {
  dataset: string;
  severity: 'info' | 'warning';
  message: string;
  count: number;
}

export interface DataQualityReport {
  sourceMode: 'baseline' | 'uploaded';
  sourceLabel: string;
  dailyRowsParsed: number;
  dailyRowsSkipped: number;
  patientRowsParsed: number;
  patientRowsSkipped: number;
  targetRowsParsed: number;
  staffRowsParsed: number;
  nullValuesHandled: number;
  anomaliesFlagged: number;
  dateRange: { min: string; max: string };
  departments: string[];
  issues: DataQualityIssue[];
}

export interface HospitalDatasetBundle {
  dailyOps: DailyOpRecord[];
  targets: DepartmentTargetRecord[];
  patients: PatientEncounterRecord[];
  staff: StaffRosterRecord[];
  quality: DataQualityReport;
  files: Record<DatasetRole, UploadedCsvFile | null>;
}

export type DashboardTab = 'insights' | 'admissions' | 'workload' | 'bottlenecks';

export type ForecastMetric = 'demand' | 'occupancy' | 'staffing';

export interface DashboardFilters {
  department: string; // 'All' or department name
  startDate: string;
  endDate: string;
}

export interface ForecastPoint {
  date: string;
  dayLabel: string;
  actual: number | null;
  forecast: number | null;
  lowerBound: number | null;
  upperBound: number | null;
  rosteredTarget?: number | null;
  isForecast: boolean;
}

export interface ForecastResult {
  metric: ForecastMetric;
  metricLabel: string;
  unit: string;
  horizonDays: number;
  department: string;
  points: ForecastPoint[];
  modelName: string;
  mae: number;
  rmse: number;
  trendSlopePerWeek: number;
  projectedAvg: number;
  projectedPeak: { date: string; value: number };
  recommendedShiftStaffAvg: number;
  notes: string;
}

export interface UnderstaffedAlert {
  date: string;
  department: string;
  doctorsOnDuty: number;
  doctorsTarget: number;
  nursesOnDuty: number;
  nursesTarget: number;
  supportOnDuty: number;
  supportTarget: number;
  totalDeficit: number;
  patientToStaffRatio: number;
  bedOccupancyRate: number;
  avgWaitTimeMinutes: number;
  severity: 'Critical' | 'Elevated';
}

export interface ForecastAction {
  horizonDays: number;
  metric: ForecastMetric;
  department?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  dataScope?: string;
  forecastAction?: ForecastAction;
  isError?: boolean;
}
